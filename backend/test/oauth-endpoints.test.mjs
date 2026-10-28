/**
 * Executed test for the Google OAuth endpoints the backend exposes.
 *
 * Checks, against the running server on :3005:
 *   GET /auth/google              → exists, shows the setup page + redirect URI
 *   GET /auth/google/callback     → exists, shows the setup page while unconfigured
 *   GET /api/auth/google/status   → reports configured:false
 *   POST /api/auth/login/google   → 503 while unconfigured (not a 500)
 */
const BASE = "http://localhost:3005";
let pass = 0;
let fail = 0;
const ok = (label, condition, detail = "") => {
  if (condition) { pass += 1; console.log(`PASS  ${label}`); }
  else { fail += 1; console.log(`FAIL  ${label}  ${detail}`); }
};

const get = async (path) => {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: response.status, text: await response.text(), headers: response.headers };
};
const post = async (path, body) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
};

try {
  const start = await get("/auth/google");
  ok("GET /auth/google responds", start.status > 0, `status ${start.status}`);
  ok("GET /auth/google returns 503 until configured", start.status === 503, `status ${start.status}`);
  ok("setup page names the redirect URI", start.text.includes("http://localhost:3005/auth/google/callback"));
  ok("setup page tells you where to paste it", start.text.includes("console.cloud.google.com"));
  ok("setup page states which env vars are missing", start.text.includes("GOOGLE_CLIENT_ID") && start.text.includes("GOOGLE_CLIENT_SECRET"));
  ok("setup page is HTML", (start.headers.get("content-type") ?? "").includes("text/html"));

  const callback = await get("/auth/google/callback?state=abc&code=xyz");
  ok("GET /auth/google/callback responds", callback.status === 503, `status ${callback.status}`);
  ok("callback also shows the setup page", callback.text.includes("Google sign-in is not configured yet"));

  const status = await get("/api/auth/google/status");
  const payload = status.json ?? JSON.parse(status.text || "{}");
  ok("GET /api/auth/google/status responds", status.status === 200, `status ${status.status}`);
  ok("status reports configured:false while env is empty", payload.configured === false, JSON.stringify(payload));

  const login = await post("/api/auth/login/google", { credential: "aaaa.bbbb.cccc.dddd.eeee" });
  ok("POST /api/auth/login/google refuses cleanly while unconfigured", login.status === 503, `status ${login.status} ${JSON.stringify(login.json)}`);
  ok("refusal message is readable", typeof login.json.message === "string" && login.json.message.length > 0);

  const bad = await post("/api/auth/login/google", { credential: "too-short" });
  ok("malformed credential fails validation with 400", bad.status === 400, `status ${bad.status} ${JSON.stringify(bad.json)}`);
} catch (error) {
  ok("server reachable", false, error.message);
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
