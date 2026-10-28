import crypto from "node:crypto";
import { Router } from "express";
import env from "../config/env.js";
import { GoogleTokenError, verifyGoogleIdToken } from "../utils/google-id.js";
import { AccountSuspendedError, signInWithGoogleClaims } from "../services/authService.js";

/**
 * Google's authorization-code flow.
 *
 *   GET /auth/google          → sends the browser to Google's consent screen
 *   GET /auth/google/callback → exchanges the code, signs the user in, then
 *                               returns them to the SPA at /auth/callback
 *
 * The callback URL (GOOGLE_REDIRECT_URI) is the one that has to be registered
 * on the OAuth client in Google Cloud Console, so these two routes exist
 * exactly as Google expects them: a plain browser redirect, no CORS, no JSON.
 */

const router = Router();

const STATE_COOKIE = "muhurtham_oauth_state";
const STATE_PATH = "/auth/google";
const STATE_TTL_MS = 10 * 60 * 1000;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** state → PKCE code_verifier. Single use, pruned on read and by age. */
const pendingStates = new Map();

const pruneStates = () => {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (entry.expiresAt <= now) pendingStates.delete(state);
  }
};

const base64url = (input) => Buffer.from(input).toString("base64url");
const configured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Escape user-controlled text before it goes into an HTML page. */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]
));

const setupPage = () => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Google sign-in setup</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         background:#0f0d0b; color:#f4efe6; display:flex; min-height:100vh;
         align-items:center; justify-content:center; padding:24px; }
  main { max-width:640px; width:100%; background:#191512; border:1px solid #3a3128;
         border-radius:16px; padding:28px 32px; }
  h1 { font-size:20px; margin:0 0 6px; }
  p { margin:0 0 14px; color:#c9bfb2; font-size:14px; }
  code { display:block; background:#0c0a08; border:1px solid #3a3128; border-radius:8px;
         padding:10px 12px; margin:6px 0 16px; font-size:13px; word-break:break-all;
         color:#e8c98a; }
  ol { margin:0 0 16px; padding-left:20px; color:#c9bfb2; font-size:14px; }
  li { margin-bottom:8px; }
  a { color:#e8c98a; }
  .muted { color:#8b8175; font-size:13px; }
</style></head>
<body><main>
  <h1>Google sign-in is not configured yet</h1>
  <p>The OAuth endpoints are live and waiting for credentials. Register this
     redirect URI on your Google OAuth client:</p>
  <code>${escapeHtml(env.GOOGLE_REDIRECT_URI)}</code>
  <ol>
    <li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console → APIs &amp; Services → Credentials</a>.</li>
    <li>Create an <strong>OAuth client ID</strong> of type <strong>Web application</strong>.</li>
    <li>Add the URI above to <strong>Authorised redirect URIs</strong>.</li>
    <li>Copy the client ID and secret into <code style="display:inline;padding:2px 6px;margin:0">backend/.env</code>:
      <br /><code>GOOGLE_CLIENT_ID=...apps.googleusercontent.com</code>
      <code>GOOGLE_CLIENT_SECRET=GOCSPX-...</code></li>
    <li>Restart the backend, then use <strong>Continue with Google</strong> on the login screen.</li>
  </ol>
  <p class="muted">Until <code style="display:inline;padding:2px 6px;margin:0">GOOGLE_CLIENT_ID</code> and
     <code style="display:inline;padding:2px 6px;margin:0">GOOGLE_CLIENT_SECRET</code> are set, password login
     keeps working and this route returns this page.</p>
</main></body></html>`;

/** Sends the browser back to the SPA with either a token or a reason. */
const returnToApp = (res, params) => {
  const hash = new URLSearchParams(params).toString();
  res.redirect(`${env.FRONTEND_URL}/auth/callback#${hash}`);
};

/**
 * Step 1 — hand the browser to Google.
 *
 * The state is random, single-use, remembered server-side and echoed in an
 * httpOnly cookie, so a callback can only complete a flow this server started
 * in this browser (cross-site request forgery), and PKCE stops a stolen
 * authorization code from being redeemed elsewhere.
 */
router.get("/google", (req, res) => {
  if (!configured()) return res.status(503).type("html").send(setupPage());

  try {
    pruneStates();
    const state = base64url(crypto.randomBytes(32));
    const verifier = base64url(crypto.randomBytes(48));
    const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
    pendingStates.set(state, { verifier, expiresAt: Date.now() + STATE_TTL_MS });

    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: STATE_PATH,
      maxAge: STATE_TTL_MS,
    });

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GOOGLE_REDIRECT_URI);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    // Always ask which account, so a second Google account is never silently used.
    url.searchParams.set("prompt", "select_account");
    return res.redirect(url.toString());
  } catch (error) {
    console.error("auth/google error:", error);
    return returnToApp(res, { error: "Could not start Google sign-in." });
  }
});

/** Step 2 — exchange the code, sign the user in, hand the token to the SPA. */
router.get("/google/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const cookieState = typeof req.cookies?.[STATE_COOKIE] === "string" ? req.cookies[STATE_COOKIE] : "";
  res.clearCookie(STATE_COOKIE, { path: STATE_PATH });

  const entry = pendingStates.get(state);
  pendingStates.delete(state);

  if (!configured()) return res.status(503).type("html").send(setupPage());
  if (!state || !entry || entry.expiresAt <= Date.now() || cookieState !== state) {
    return returnToApp(res, { error: "That sign-in attempt expired or was not started here. Please try again." });
  }

  const oauthError = typeof req.query.error === "string" ? req.query.error : "";
  if (oauthError || typeof req.query.code !== "string") {
    const reason = typeof req.query.error_description === "string" ? req.query.error_description : "Google did not approve the sign-in.";
    return returnToApp(res, { error: reason });
  }

  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        code_verifier: entry.verifier,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const tokens = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !tokens.id_token) {
      console.error("Google token exchange failed:", tokenResponse.status, tokens.error ?? tokens);
      return returnToApp(res, { error: "Google did not return a sign-in token. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
    }

    // Trust nothing from the token exchange until the id_token is verified
    // against Google's own signing keys and our own client id.
    const claims = await verifyGoogleIdToken(tokens.id_token, env.GOOGLE_CLIENT_ID);
    const { token } = await signInWithGoogleClaims(claims);
    return returnToApp(res, { token });
  } catch (error) {
    if (error instanceof AccountSuspendedError) return returnToApp(res, { error: error.message });
    if (error instanceof GoogleTokenError) return returnToApp(res, { error: error.message });
    console.error("auth/google/callback error:", error);
    return returnToApp(res, { error: "Google sign-in failed. Please try again." });
  }
});

export default router;
