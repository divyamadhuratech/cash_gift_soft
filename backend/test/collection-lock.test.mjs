/**
 * Executed test for the one-open-collection lock:
 *
 *   backend/src/services/functionService.js  openFunction / closeFunction
 *   backend/src/services/entryService.js     createEntry guard
 *
 * A workspace may hold only one open collection at a time. Creating a second
 * (upcoming) function is allowed; opening it or recording a gift against it
 * must fail until the first is closed.
 */
import mongoose from "mongoose";
import "dotenv/config";

const BASE = "http://localhost:3005/api";
let pass = 0;
let fail = 0;
const ok = (label, condition, detail = "") => {
  if (condition) { pass += 1; console.log(`PASS  ${label}`); }
  else { fail += 1; console.log(`FAIL  ${label}  ${detail}`); }
};

const call = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
};

const email = `locktest_${Date.now()}@example.com`;
let token = null;
let fnA = null;
let fnB = null;

try {
  const register = await call("POST", "/auth/register", { body: { email, password: "secret123", displayName: "Lock Test" } });
  ok("register temp user", register.status === 201, JSON.stringify(register.json));
  token = register.json.token;

  const a = await call("POST", "/functions", { token, body: { name: "Function A", date: "2026-11-01" } });
  const b = await call("POST", "/functions", { token, body: { name: "Function B", date: "2026-12-01" } });
  fnA = a.json.function?._id;
  fnB = b.json.function?._id;
  ok("created both functions", Boolean(fnA && fnB), JSON.stringify({ a: a.status, b: b.status }));

  // --- the lock itself -----------------------------------------------------
  const openA = await call("POST", `/functions/${fnA}/open`, { token });
  ok("open A succeeds when nothing is open", openA.status === 200, `status ${openA.status} ${openA.json.message}`);
  ok("open A stamps collectionOpenAt", Boolean(openA.json.function?.collectionOpenAt));

  const openB = await call("POST", `/functions/${fnB}/open`, { token });
  ok("open B is refused while A is open", openB.status === 409, `status ${openB.status} ${openB.json.message}`);
  ok("refusal names the function that is open", /Function A/.test(openB.json.message ?? ""), openB.json.message ?? "");
  ok("refusal explains only one at a time", /one collection/i.test(openB.json.message ?? ""));

  // --- recording gifts ------------------------------------------------------
  const giftA = await call("POST", "/entries", { token, body: { function: fnA, name: "Guest A", amount: 500 } });
  ok("gift recorded in the open function", giftA.status === 201, `status ${giftA.status} ${giftA.json.message}`);

  const giftB = await call("POST", "/entries", { token, body: { function: fnB, name: "Guest B", amount: 700 } });
  ok("gift refused in a function that is not open", giftB.status === 409, `status ${giftB.status} ${giftB.json.message}`);
  ok("entry refusal names the open function", /Function A/.test(giftB.json.message ?? ""), giftB.json.message ?? "");

  // --- closing releases the lock -------------------------------------------
  const closeA = await call("POST", `/functions/${fnA}/close`, { token });
  ok("closing A succeeds", closeA.status === 200, `status ${closeA.status}`);
  ok("closing A releases the lock", closeA.json.function?.collectionOpenAt === null || closeA.json.function?.collectionOpenAt === undefined,
    JSON.stringify(closeA.json.function?.collectionOpenAt));

  const openAagain = await call("POST", `/functions/${fnA}/open`, { token });
  ok("a closed function cannot be reopened as an open collection", openAagain.status === 400, `status ${openAagain.status} ${openAagain.json.message}`);

  const closedGift = await call("POST", "/entries", { token, body: { function: fnA, name: "Guest C", amount: 100 } });
  ok("gift refused in a closed function", closedGift.status === 400, `status ${closedGift.status} ${closedGift.json.message}`);

  // --- now B can take the slot ---------------------------------------------
  const openB2 = await call("POST", `/functions/${fnB}/open`, { token });
  ok("open B succeeds once A is closed", openB2.status === 200, `status ${openB2.status} ${openB2.json.message}`);

  const giftB2 = await call("POST", "/entries", { token, body: { function: fnB, name: "Guest B", amount: 700 } });
  ok("gift recorded in B after the handover", giftB2.status === 201, `status ${giftB2.status} ${giftB2.json.message}`);

  const openA3 = await call("POST", `/functions/${fnA}/open`, { token });
  ok("opening A while closed is a 400 (archived beats the lock)", openA3.status === 400, `status ${openA3.status} ${openA3.json.message}`);

  // --- reopening does not silently claim the slot --------------------------
  const reopenA = await call("POST", `/functions/${fnA}/reopen`, { token });
  ok("reopening A succeeds", reopenA.status === 200, `status ${reopenA.status}`);
  ok("reopening A does not take the open slot", !reopenA.json.function?.collectionOpenAt, JSON.stringify(reopenA.json.function?.collectionOpenAt));

  // A is now open-able again, but B still holds the single slot.
  const openAWhileB = await call("POST", `/functions/${fnA}/open`, { token });
  ok("open A is refused while B holds the slot", openAWhileB.status === 409, `status ${openAWhileB.status} ${openAWhileB.json.message}`);
  ok("that refusal names B", /Function B/.test(openAWhileB.json.message ?? ""), openAWhileB.json.message ?? "");

  // --- malformed / foreign ids ---------------------------------------------
  const ghost = await call("POST", "/functions/ffffffffffffffffffffffff/open", { token });
  ok("opening a missing function 404s", ghost.status === 404, `status ${ghost.status}`);

  const badEntry = await call("POST", "/entries", { token, body: { function: "not-an-object-id", name: "X", amount: 10 } });
  ok("entry for an unsaved function id 400s instead of 500", badEntry.status === 400, `status ${badEntry.status} ${badEntry.json.message}`);
} catch (error) {
  ok("server reachable", false, error.message);
}

// --- cleanup: temp user, their workspace, functions and entries -------------
try {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await mongoose.connection.db.collection("users").find({ email: /^locktest_/ }).toArray();
  const ids = users.map((u) => u._id);
  if (ids.length) {
    const workspaceIds = users.map((u) => u.workspace).filter(Boolean);
    await mongoose.connection.db.collection("functions").deleteMany({ owner: { $in: ids } });
    await mongoose.connection.db.collection("entries").deleteMany({ owner: { $in: ids } });
    if (workspaceIds.length) await mongoose.connection.db.collection("workspaces").deleteMany({ _id: { $in: workspaceIds } });
    await mongoose.connection.db.collection("users").deleteMany({ _id: { $in: ids } });
  }
  console.log(`cleanup: removed ${ids.length} temp user(s)`);
  await mongoose.disconnect();
} catch (error) {
  console.log("cleanup warning:", error.message);
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
