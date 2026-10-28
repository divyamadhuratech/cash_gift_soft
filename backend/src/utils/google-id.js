import { createRemoteJWKSet, jwtVerify } from "jose";

const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/**
 * Google rotates its signing keys, so each key set is fetched on demand and
 * cached by `jose` (with a refetch when an unknown `kid` arrives). Keyed by
 * URL so tests can point the verifier at their own key set.
 */
const keySets = new Map();
const keySetFor = (url) => {
  if (!keySets.has(url)) {
    keySets.set(url, createRemoteJWKSet(new URL(url), {
      cooldownDuration: 30_000,
      cacheMaxAge: 60 * 60 * 1000,
      timeoutDuration: 8_000,
    }));
  }
  return keySets.get(url);
};

/** Anything that must not be treated as a trusted identity. */
export class GoogleTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = "GoogleTokenError";
  }
}

/**
 * Verifies the `credential` Google Identity Services hands to the browser and
 * returns its claims. Signature, issuer, audience and expiry are all checked
 * against Google's own keys — a forged token never reaches the auth service.
 *
 * `certsUrl` exists for tests; production always uses Google's endpoint.
 */
export async function verifyGoogleIdToken(idToken, audience, { certsUrl = CERTS_URL } = {}) {
  if (!audience) {
    throw new GoogleTokenError("Google sign-in is not configured on this server.");
  }
  if (typeof idToken !== "string" || idToken.split(".").length !== 3) {
    throw new GoogleTokenError("That Google sign-in response was not valid.");
  }

  try {
    const { payload } = await jwtVerify(idToken, keySetFor(certsUrl), { issuer: ISSUERS, audience });
    if (!payload.email) throw new GoogleTokenError("That Google account has no email address.");
    if (payload.email_verified === false) throw new GoogleTokenError("That Google email address is not verified.");
    return payload;
  } catch (error) {
    if (error instanceof GoogleTokenError) throw error;
    throw new GoogleTokenError("Google could not verify that sign-in. Please try again.");
  }
}
