/**
 * Executed test for backend/src/utils/google-id.js
 *
 * Serves a self-made RSA JWKS over local HTTP, signs real RS256 tokens with
 * it, and runs the production verifier against: a good token, a wrong audience,
 * an expired token, a tampered payload, a wrong key id on Google's real keyset,
 * a malformed token, an unverified email, and a missing audience config.
 */
import http from "node:http";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { GoogleTokenError, verifyGoogleIdToken } from "../src/utils/google-id.js";

const AUD = "1234567890-client.apps.googleusercontent.com";
const ISS = "https://accounts.google.com";
let pass = 0;
let fail = 0;
const ok = (label, condition, detail = "") => {
  if (condition) { pass += 1; console.log(`PASS  ${label}`); }
  else { fail += 1; console.log(`FAIL  ${label}  ${detail}`); }
};

const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const publicJwk = { ...(await exportJWK(publicKey)), kid: "local-key-1", alg: "RS256", use: "sig" };

const server = http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ keys: [publicJwk] }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const certsUrl = `http://127.0.0.1:${server.address().port}/jwks.json`;

const sign = async ({ kid = "local-key-1", aud = AUD, exp = "10m", email = "tester@example.com", verified = true } = {}) =>
  new SignJWT({ email, email_verified: verified, name: "Tester", picture: "" })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuedAt()
    .setIssuer(ISS)
    .setAudience(aud)
    .setExpirationTime(exp)
    .sign(privateKey);

const rejects = async (label, run, expectType = GoogleTokenError) => {
  try {
    await run();
    ok(label, false, "expected a rejection but it succeeded");
  } catch (error) {
    const rightType = error instanceof expectType;
    ok(label, rightType, `threw ${error?.constructor?.name}: ${error?.message}`);
    if (!rightType) console.log("      ->", error?.message);
  }
};

/** Re-signs nothing: edits the payload and keeps the original signature. */
const tamper = (token) => {
  const [header, payload, signature] = token.split(".");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  claims.email = "admin@example.com";
  const edited = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${edited}.${signature}`;
};

const good = await sign();
const claims = await verifyGoogleIdToken(good, AUD, { certsUrl });
ok("valid token accepted", claims.email === "tester@example.com" && claims.email_verified === true, JSON.stringify(claims));

await rejects("wrong audience rejected", () => verifyGoogleIdToken(good, "other-client.apps.googleusercontent.com", { certsUrl }));
await rejects("expired token rejected", async () => {
  const expired = await sign({ exp: "-10s" });
  return verifyGoogleIdToken(expired, AUD, { certsUrl });
});
await rejects("tampered payload rejected", () => verifyGoogleIdToken(tamper(good), AUD, { certsUrl }));
await rejects("malformed token rejected", () => verifyGoogleIdToken("not.a-jwt", AUD, { certsUrl }));
await rejects("empty token rejected", () => verifyGoogleIdToken("", AUD, { certsUrl }));
await rejects("unverified email rejected", async () => {
  const token = await sign({ verified: false });
  return verifyGoogleIdToken(token, AUD, { certsUrl });
});
await rejects("missing server audience config rejected", () => verifyGoogleIdToken(good, "", { certsUrl }));
await rejects("wrong issuer rejected", async () => {
  const token = await new SignJWT({ email: "a@b.com", email_verified: true })
    .setProtectedHeader({ alg: "RS256", kid: "local-key-1" })
    .setIssuedAt()
    .setIssuer("https://evil.example.com")
    .setAudience(AUD)
    .setExpirationTime("10m")
    .sign(privateKey);
  return verifyGoogleIdToken(token, AUD, { certsUrl });
});

// The production keyset URL: proves it is reachable, and that a token signed by
// a key Google does not hold is refused there too, not just on the local set.
try {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { signal: AbortSignal.timeout(8000) });
  const body = await response.json();
  ok("Google's real keyset is reachable", response.ok && Array.isArray(body.keys) && body.keys.length > 0, `status ${response.status}`);
} catch (error) {
  ok("Google's real keyset is reachable", false, error.message);
}
await rejects("unknown key id on Google's real keyset rejected", () => verifyGoogleIdToken(good, AUD, { certsUrl: "https://www.googleapis.com/oauth2/v3/certs" }));

server.close();
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
