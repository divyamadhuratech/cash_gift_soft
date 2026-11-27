# Google Authentication — Code Review & Portability Report

> Scope: the Google sign-in feature as implemented in this repository, frontend and backend.
> Purpose: explain how it is written, how the Google APIs and tokens are used, and whether it will
> run unchanged on another machine/deployment with the same environment variables.

---

## 1. Executive verdict

**Short answer:** Yes, this feature is portable **if** the new system has:

1. Node.js **18+** (uses global `fetch`, `AbortSignal.timeout`, `Buffer.toString("base64url")`).
2. The same env values, **and** the public URLs are updated when the host/port changes.
3. A Google Cloud OAuth client whose **Authorised redirect URI exactly matches** `GOOGLE_REDIRECT_URI`.
4. Outbound HTTPS access to `accounts.google.com`, `oauth2.googleapis.com`, `www.googleapis.com`.
5. MongoDB and a valid `JWT_SECRET`.

It is **not** a drop-in copy for a horizontally-scaled deployment: OAuth `state` is stored in an
in-memory `Map`, so it only works reliably on **one backend instance** (no restarts between the
Google redirect and the callback, no load balancing across replicas). Fixing that requires a shared
store (Redis/DB), which is **extra manual work**.

There is also an integration test that assumes Google is **unconfigured** and will fail once real
credentials are set (details in §10).

---

## 2. File map (manual verification order)

### Frontend (`src/`)
  
| # | File | What to verify |
|---|------|----------------|
| 1 | `src/lib/api.js` | `apiOrigin`, `googleLoginUrl` (lines 9–12); axios client; token storage; 401 interceptor |
| 2 | `src/components/ceremony/login-screen.jsx` | Google status fetch (33–39); "Continue with Google" button (78–91); redirect at line 85 |
| 3 | `src/App.jsx` | `/auth/callback` route (26–29) |
| 4 | `src/components/ceremony/google-callback-screen.jsx` | Reads token/error from URL hash, scrubs history, calls `completeGoogleLogin` |
| 5 | `src/contexts/AuthContext.jsx` | `completeGoogleLogin` (100–127); session restore (130–184); `isAuthenticated` |
| 6 | `src/contexts/auth-context.js` / `src/contexts/useAuth.js` | Context + hook plumbing |

### Backend (`backend/src/`)

| # | File | What to verify |
|---|------|----------------|
| 1 | `backend/src/config/env.js` | Google + JWT + Mongo env schema (14–22) |
| 2 | `backend/src/models/User.js` | `password` optional, `googleId`, `provider`, `picture`, `status` |
| 3 | `backend/src/models/Workspace.js` | Workspace created for every account (referenced by auth service) |
| 4 | `backend/src/utils/jwt.js` | App JWT signing (7d default) |
| 5 | `backend/src/utils/google-id.js` | Google `id_token` verification against Google JWKS |
| 6 | `backend/src/utils/validation.js` | `googleLoginSchema` (36–38) |
| 7 | `backend/src/services/authService.js` | `googleStatus`, `signInWithGoogleClaims`, `loginWithGoogle`, `provisionAccount` |
| 8 | `backend/src/routes/authRoutes.js` | `/login/google`, `/google/status` |
| 9 | `backend/src/routes/googleAuthRoutes.js` | Authorization Code + PKCE redirect flow |
| 10 | `backend/src/middleware/auth.js` | Bearer JWT check for protected routes |
| 11 | `backend/src/app.js` | `cookieParser`, CORS, mounting `/api/auth` and `/auth` |
| 12 | `backend/src/server.js` | Boot (also starts WhatsApp, unrelated) |
| 13 | `backend/.env.example` | Required/optional variables |
| 14 | `backend/test/google-verify.test.mjs` | Unit test for token verification |
| 15 | `backend/test/oauth-endpoints.test.mjs` | Integration test (assumes unconfigured) |

---

## 3. There are TWO Google flows in the code (only one is used by the UI)

### Flow A — Authorization Code + PKCE redirect (the one actually used)

The login button does a **full-page redirect**:

```
Browser → GET {backend}/auth/google
        → 302 to accounts.google.com/o/oauth2/v2/auth
        → user consents
        → 302 to {backend}/auth/google/callback?code=...&state=...
        → backend exchanges code for tokens (client_secret + PKCE verifier)
        → backend verifies id_token against Google JWKS
        → backend finds/creates user, signs its OWN JWT
        → 302 to {FRONTEND_URL}/auth/callback#token=<app JWT>
        → SPA reads hash, stores JWT in localStorage, calls /api/auth/me
```

- Frontend entry point: `googleLoginUrl = ${apiOrigin}/auth/google` (`src/lib/api.js:12`).
- Backend entry: `router.get("/google", ...)` (`googleAuthRoutes.js:99`).
- Backend callback: `router.get("/google/callback", ...)` (`googleAuthRoutes.js:135`).

### Flow B — Google Identity Services credential endpoint (present, NOT used by this SPA)

- `POST /api/auth/login/google` with `{ credential }` where `credential` is a Google-signed JWT
  (`authRoutes.js:11`, `authService.js:185`).
- This is for the "Sign in with Google" JS widget (`accounts.google.com/gsi/client`).
- **The frontend never loads that script and never calls this endpoint** (verified: only
  `googleLoginUrl` is referenced in `src/`). It is effectively an alternative/legacy API surface
  that is still tested by `oauth-endpoints.test.mjs`.

> Manual coding note: if you keep only one flow in your rewrite, keep **Flow A**. Flow B is dead
> code from the UI's perspective, but harmless and useful if you later add the GIS widget.

---

## 4. Step-by-step logic

### 4.1 Login screen decides whether to show the button

`login-screen.jsx:33-39`

```js
api.get('/auth/google/status')
  .then(({ data }) => setGoogleEnabled(Boolean(data?.configured)))
```

- Backend `GET /api/auth/google/status` (`authRoutes.js:13`) returns
  `{ configured: googleStatus() }`.
- `googleStatus()` is `Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)`
  (`authService.js:131`). **Both** are required for the button to appear.
- If the API call fails, the catch is silent → password login still works, button hidden.

### 4.2 Starting the OAuth flow

`googleAuthRoutes.js:99-132`

1. If not configured → HTTP 503 with a self-contained **setup instructions HTML page**
   (`setupPage()`, lines 45–83). This page prints the exact redirect URI to register.
2. `state` = 32 random bytes, base64url.
3. `verifier` = 48 random bytes, base64url; `challenge` = SHA-256(verifier), base64url (PKCE S256).
4. Store `state → { verifier, expiresAt }` in an **in-memory Map** for 10 minutes.
5. Set an **httpOnly cookie** `muhurtham_oauth_state`:
   - `sameSite: "lax"`, `secure: NODE_ENV === "production"`, `path: "/auth/google"`,
     `maxAge: 10 min`.
6. Build Google authorization URL with:
   - `client_id`, `redirect_uri`, `response_type=code`,
   - `scope=openid email profile`,
   - `state`, `code_challenge`, `code_challenge_method=S256`,
   - `prompt=select_account` (always let the user pick an account).
7. Redirect the browser to Google.

### 4.3 Callback handling

`googleAuthRoutes.js:135-185`

1. Read `state` from query and the state cookie; clear the cookie.
2. Look up and **delete** the state from the Map (single-use).
3. Reject if: not configured, missing/unknown/expired state, or cookie ≠ query state.
4. If Google returned `error` or no `code`, redirect to the SPA with an error message.
5. Exchange the code at `https://oauth2.googleapis.com/token` via `fetch`:
   - `code`, `client_id`, `client_secret`, `redirect_uri`,
   - `code_verifier` (from the Map), `grant_type=authorization_code`.
   - 10-second timeout.
6. Require `id_token` in the response.
7. `verifyGoogleIdToken(id_token, GOOGLE_CLIENT_ID)`.
8. `signInWithGoogleClaims(claims)` → find/link/create user → sign **app JWT**.
9. Redirect to `${FRONTEND_URL}/auth/callback#token=<app jwt>` (or `#error=...`).

### 4.4 id_token verification

`google-id.js:38-54`

- Rejects empty audience (server not configured).
- Rejects anything that is not a 3-part JWT.
- Uses `jose.jwtVerify` with:
  - `createRemoteJWKSet("https://www.googleapis.com/oauth2/v3/certs")` — keys cached 1h,
    cooldown 30s, refetch on unknown `kid`, 8s timeout.
  - `issuer` ∈ `{https://accounts.google.com, accounts.google.com}`.
  - `audience` = `GOOGLE_CLIENT_ID`.
  - Signature + expiry are checked by `jose`.
- Additionally requires `email` present and `email_verified !== false`.
- Maps all failures to `GoogleTokenError` with a user-safe message.

This is the security-critical boundary: **nothing from Google is trusted until this passes**.

### 4.5 Finding / linking / creating the account

`authService.js:150-178` (`signInWithGoogleClaims`)

- Normalise email to lowercase.
- Lookup: `User.findOne({ $or: [{ googleId: claims.sub }, { email }] })`.
- If found:
  - `status === "suspended"` → `AccountSuspendedError` (403 / redirect error).
  - Fill missing `googleId`, `displayName`, `picture`.
  - Update `lastLogin`.
  - If an account with a password already exists for that email, **it is linked** to the Google
    identity (Google has proven mailbox control). The user can then use either method.
- If not found:
  - `provisionAccount` creates a `Workspace` and a `User` with `provider: "google"`,
    `password: undefined`, `role: "user"`.
- Returns `{ token: signToken({ userId, email, role }), user }`.

### 4.6 Frontend callback screen

`google-callback-screen.jsx`

- Reads `token` / `error` from `window.location.hash` (hash is not sent to the server or proxies).
- Immediately scrubs the URL with `history.replaceState` (line 36) so the token is not left in
  history.
- `started` ref prevents React StrictMode/double-effect from spending the token twice.
- Calls `completeGoogleLogin(token)`.
- On success → `navigate("/", { replace: true })`.
- On failure → shows the error with a "Back to sign in" link.

### 4.7 App session

`AuthContext.jsx:100-127`

- Stores the app JWT in `localStorage` (`muhurtham-auth-token`) and user JSON
  (`muhurtham-auth-user`).
- Calls `GET /api/auth/me` to validate/refresh the user.
- On any 401, the axios interceptor (`api.js:100-110`) clears storage and logs out.
- On boot, `restoreSession` (`AuthContext.jsx:130-184`) reuses the stored token and verifies it.

---

## 5. Tokens & secrets — what is what

| Token | Issuer | Lifetime | Where stored | Verified by |
|-------|--------|----------|--------------|-------------|
| OAuth `state` (not a token, but a nonce) | this server | 10 min, single use | server memory + httpOnly cookie | this server |
| PKCE `code_verifier` | this server | 10 min | server memory | sent to Google token endpoint |
| Google `code` | Google | very short | query string | exchanged server-side |
| Google `id_token` (JWT, RS256) | Google | ~1h | never stored, never sent to browser | `jose` + Google JWKS |
| Google `access_token` | Google | ~1h | **not used/stored** (scope only needs identity) | n/a |
| App JWT | this backend (`JWT_SECRET`) | `JWT_EXPIRES_IN` (7d) | `localStorage` on the SPA | `middleware/auth.js` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | static | `backend/.env` | used only in token exchange |

Important: **no Google access/refresh token is persisted**. The app only uses Google to prove
identity once, then runs on its own JWT. There is no "revoke Google" flow and no offline access.

---

## 6. Security controls present

- Authorization Code + **PKCE S256** (stolen code cannot be redeemed without verifier).
- **State** nonce, single-use, server-side + httpOnly cookie (CSRF / login-CSRF protection).
- **httpOnly / SameSite=Lax / Secure-in-production** state cookie; path-scoped.
- `id_token` signature, issuer, audience, expiry verified against Google's live JWKS.
- `email_verified` enforced.
- Account suspension checked on every Google sign-in.
- Google login route validates body with Zod (credential length 20–8192).
- Rate limiting on `/auth` and `/api`.
- Helmet enabled (with cross-origin resource policy relaxed for uploads).
- Token returned in URL **hash** (never sent to server) and scrubbed from history.
- App JWT is a bearer token checked on every protected request.

### Known weaknesses / risks (not blockers for portability)

- **In-memory `pendingStates`**: breaks with multiple backend replicas, and any restart between
  redirect and callback invalidates the flow. Needs Redis/DB for scale.
- App JWT in `localStorage` — XSS would expose it. Standard tradeoff; no httpOnly cookie session.
- No explicit CSRF protection on other (Bearer-auth) routes; Bearer tokens are not sent
  automatically, which mitigates classic CSRF.
- `googleStatus()` requires the **secret** as well as the id, but the credential flow
  (`loginWithGoogle`) only needs the id. This is a minor inconsistency: setting only
  `GOOGLE_CLIENT_ID` hides the button even though the API endpoint could work.
- The `/auth` rate limiter is applied to the router mount and shares a window with `/api`; fine for
  normal traffic, but a strict global limit can throttle the OAuth redirect too.

---

## 7. Environment variables

From `backend/src/config/env.js` and `backend/.env.example`:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `MONGO_URI` | yes | — | valid URL, Mongo connection |
| `JWT_SECRET` | yes | — | **min 32 chars**; app JWT signing |
| `JWT_EXPIRES_IN` | no | `7d` | app session lifetime |
| `CORS_ORIGIN` | no | `http://localhost:5173` | must equal the SPA origin exactly |
| `GOOGLE_CLIENT_ID` | for Google | `""` | `...apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | for redirect flow | `""` | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | yes if Google | `http://localhost:3005/auth/google/callback` | **must match Google Console exactly** |
| `FRONTEND_URL` | yes if Google | `http://localhost:5173` | where the SPA callback lives |

Frontend (`VITE_API_BASE_URL`, default `http://localhost:3005/api`) must include the `/api`
suffix. `apiOrigin` strips a trailing `/api` to build the `/auth/google` URL.

---

## 8. Will it work on another system with the same env?

### Works unchanged when ALL of these are true

- Node 18+; `npm install` in `backend/` (deps: `express`, `jose`, `cookie-parser`, `jsonwebtoken`,
  `bcrypt`, `mongoose`, `zod`, `cors`, `helmet`, `morgan`, `express-rate-limit`, `dotenv`).
- MongoDB reachable at `MONGO_URI`.
- `JWT_SECRET` ≥ 32 chars.
- The exact same host/port as the env values (e.g. all `localhost`).
- The OAuth client in Google Cloud has the exact redirect URI
  `http://localhost:3005/auth/google/callback`.
- The OAuth consent screen is configured (in "Testing" mode, the signing-in Google account must be
  added as a **test user**).
- Outbound HTTPS to Google is allowed (for JWKS + token exchange).
- Frontend served at `FRONTEND_URL`; CORS origin matches.
- Single backend instance, and it does not restart between step 1 and the callback.

### Needs manual changes when anything below differs

| Change | What must be updated |
|--------|----------------------|
| Different host/domain/port | `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `CORS_ORIGIN`, `VITE_API_BASE_URL`, **and** Google Console redirect URI |
| HTTPS production | Set `NODE_ENV=production` for `Secure` cookie; terminate TLS correctly. Testing a "production" build over plain HTTP will make the state cookie be dropped and login will fail |
| Reverse proxy / load balancer | Single instance is required by the in-memory state store. Multi-replica needs a shared state store |
| Serverless (Lambda/Vercel functions) | In-memory state + no persistent process; the redirect/callback fixture is risky. Prefer a long-running server |
| Different OAuth client | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; audience check uses the id |
| Custom domain for Google | Add it to the OAuth client; keep the exact URI |
| Different SPA route than `/auth/callback` | Change both the backend `returnToApp` and `App.jsx` |
| Node < 18 | Feature breaks (`fetch`, `base64url`, `AbortSignal.timeout`) |

### Verdict

- **Single-server deployment:** portable with env + Google Console setup only. No code changes.
- **Scaled/cloud-native deployment:** **not** portable as-is; you must replace the in-memory
  `pendingStates` Map with a shared store and review cookie/proxy settings.

---

## 9. Manual setup checklist for a new system

1. `cd backend && npm install`.
2. Copy `.env.example` → `.env`; set `MONGO_URI`, `JWT_SECRET` (≥32 chars).
3. Create Google Cloud project → OAuth consent screen (External/Internal as needed).
4. Create **OAuth client ID → Web application**.
5. Add **Authorised redirect URI**: exactly `GOOGLE_REDIRECT_URI`.
   - For the redirect flow, **JavaScript origins are not required**.
6. Put `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` into `backend/.env`.
7. Set `GOOGLE_REDIRECT_URI`, `FRONTEND_URL`, `CORS_ORIGIN` to the real URLs.
8. Frontend `.env`: `VITE_API_BASE_URL=https://api.example.com/api`.
9. Start Mongo, backend, frontend.
10. Check `GET /api/auth/google/status` → `{"configured":true}`.
11. On the login page, the Google button should appear; click → consent → lands on `/` logged in.

If Google is not configured, `GET /auth/google` returns a 503 setup page (by design) and the button
is hidden; password auth still works.

---

## 10. Tests — and their portability trap

- `backend/test/google-verify.test.mjs`
  - Spins a local JWKS server, signs real RS256 tokens, tests valid/wrong-audience/expired/
    tampered/malformed/unverified-email/missing-audience/wrong-issuer cases.
  - Also fetches Google's **real** keyset, so it **needs internet**.
- `backend/test/oauth-endpoints.test.mjs`
  - **Assumes Google is unconfigured** (`configured:false`, 503 responses).
  - On a properly configured system these assertions **fail**. Run it only against a fresh/test
    env, or adjust it to skip when configured.
- Run: `cd backend && npm test` (unit), `npm run test:integration` (needs a server on :3005).

---

## 11. Manual verification script (recommended)

1. Unconfigured: `/auth/google` → 503 setup page; login button hidden; password login works.
2. Configure env; restart; `/api/auth/google/status` → `configured:true`.
3. Click Google → account chooser (`prompt=select_account`).
4. Consent → redirected to `/auth/callback#token=...`; hash cleared from the address bar.
5. `localStorage["muhurtham-auth-token"]` is set; refresh keeps you signed in.
6. `GET /api/auth/me` returns the Google user; workspace created.
7. Sign out; sign in with Google again → same account (no duplicate).
8. Register by password with an email, then Google-sign-in with the same email → linked account,
   no duplicate (either method works afterwards).
9. Cancel consent → back on `/auth/callback` with an error, no session.
10. Tamper the callback URL (bad `state`, replayed state, missing code) → safe error, no login.
11. Suspend the user in the DB → Google sign-in is refused.
12. Restart the backend between redirect and callback → flow fails (expected; in-memory state).
13. Run two backend instances behind a load balancer → flow may fail intermittently (expected).

---

## 12. Bottom line for your manual combination work

- The frontend/backend contract is small: `GET /api/auth/google/status`,
  `GET /auth/google`, `GET /auth/google/callback`, then `GET /api/auth/me`.
- The only pieces you must understand/rewrite carefully are:
  1. `googleAuthRoutes.js` (state + PKCE + token exchange + redirect),
  2. `google-id.js` (JWKS verification),
  3. `signInWithGoogleClaims` (link/create user),
  4. `google-callback-screen.jsx` + `completeGoogleLogin` (hash token → localStorage session).
- With the same env and a correctly registered redirect URI, **no additional code is required** on
  another single-instance system. For multiple instances or serverless, plan extra work on the
  state store.
