/**
 * Executed test for the registration/admin bootstrap security fix.
 *
 * Runs against an isolated MongoDB database named `muhurtham_test_*` and an
 * in-process Express app (auth + admin routes only). It never touches the
 * application database, and drops only the database it created.
 *
 * Covers:
 *   - normal registration creates a `user`
 *   - an explicit `role` field is rejected with 400 and creates no account
 *   - a normal user gets 403 from /api/admin/dashboard
 *   - the create-admin CLI can create the first admin without printing secrets
 *   - a second new admin is refused unless --force
 *   - the CLI can promote an existing account
 *   - the bootstrapped admin can log in and reach /api/admin/dashboard
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import mongoose from "mongoose";
import express from "express";

const backendRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: path.join(backendRoot, ".env") });

let pass = 0;
let fail = 0;
const ok = (label, condition, detail = "") => {
  if (condition) { pass += 1; console.log(`PASS  ${label}`); }
  else { fail += 1; console.log(`FAIL  ${label}  ${detail}`); }
};
const expectStatus = (label, expected, actual, extra = "") => {
  ok(label, actual === expected, `expected ${expected}, got ${actual}${extra ? ` (${extra})` : ""}`);
};

const originalUri = process.env.MONGO_URI;
if (!originalUri) {
  console.error("MONGO_URI is missing; cannot run the isolated auth test.");
  process.exit(1);
}

const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const testDbName = `muhurtham_test_${stamp}`;
const testUri = (() => {
  const url = new URL(originalUri);
  url.pathname = `/${testDbName}`;
  return url.toString();
})();

if (new URL(testUri).pathname === new URL(originalUri).pathname) {
  console.error("Refusing to run: test database resolved to the application database.");
  process.exit(1);
}

process.env.MONGO_URI = testUri;
process.env.NODE_ENV = "test";

const { default: authRoutes } = await import("../src/routes/authRoutes.js");
const { default: adminRoutes } = await import("../src/routes/adminRoutes.js");
const { notFound, errorHandler } = await import("../src/middleware/error.js");
const { default: User } = await import("../src/models/User.js");

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);

const server = await new Promise((resolve) => {
  const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
});
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const request = async (method, pathname, { token, body } = {}) => {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json };
};

const runCli = (args, password) => {
  const env = { ...process.env };
  if (password === undefined) delete env.ADMIN_BOOTSTRAP_PASSWORD;
  else env.ADMIN_BOOTSTRAP_PASSWORD = password;

  const result = spawnSync(process.execPath, [path.join(backendRoot, "scripts", "create-admin.mjs"), ...args], {
    cwd: backendRoot,
    env,
    encoding: "utf8",
    timeout: 90_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
};

const cliOutput = (result) => `${result.stdout}${result.stderr}`;

const userPassword = "UserPass123!";
const adminPassword = "AdminPass123!";
const forcePassword = "ForcePass123!";

let baselineConnection = null;
let baseline = null;
let testConnection = null;

try {
  baselineConnection = mongoose.createConnection(originalUri);
  await baselineConnection.asPromise();
  const baselineUsers = baselineConnection.db.collection("users");
  baseline = {
    total: await baselineUsers.countDocuments({}),
    admins: await baselineUsers.countDocuments({ role: "admin" }),
  };

  await mongoose.connect(testUri);
  testConnection = mongoose.connection;

  // --- normal registration --------------------------------------------------
  const normalEmail = `normal_${stamp}@example.com`;
  const normal = await request("POST", "/api/auth/register", {
    body: { email: normalEmail, password: userPassword, displayName: "Normal User" },
  });
  expectStatus("normal registration returns 201", 201, normal.status);
  ok("normal registration creates role user", normal.json.user?.role === "user", `got role ${normal.json.user?.role}`);
  const userToken = normal.json.token;
  ok("normal registration returns a token", typeof userToken === "string" && userToken.split(".").length === 3);

  // --- attempted admin escalation ------------------------------------------
  const escalationEmail = `escalate_${stamp}@example.com`;
  const escalation = await request("POST", "/api/auth/register", {
    body: { email: escalationEmail, password: userPassword, displayName: "Escalation Attempt", role: "admin" },
  });
  expectStatus("explicit role field is rejected with 400", 400, escalation.status);
  const escalatedUser = await User.findOne({ email: escalationEmail });
  ok("rejected escalation created no account", escalatedUser === null, escalatedUser ? `account exists with role ${escalatedUser.role}` : "");

  // --- non-admin authorization ---------------------------------------------
  const denied = await request("GET", "/api/admin/dashboard", { token: userToken });
  expectStatus("normal user is denied the admin dashboard", 403, denied.status);

  // --- CLI creates the first admin -----------------------------------------
  const adminEmail = `bootstrap_admin_${stamp}@example.com`;
  const created = runCli(["--email", adminEmail, "--display-name", "Bootstrap Admin"], adminPassword);
  ok("CLI create-admin exits successfully", created.status === 0, `status ${created.status}: ${created.stderr.trim()}`);
  ok("CLI reports the created account", /Created admin account/.test(created.stdout), created.stdout.trim());
  ok("CLI never prints the password", !cliOutput(created).includes(adminPassword));

  const createdAdmin = await User.findOne({ email: adminEmail });
  ok("CLI created an admin account", createdAdmin?.role === "admin", `got role ${createdAdmin?.role}`);

  const adminLogin = await request("POST", "/api/auth/login", {
    body: { email: adminEmail, password: adminPassword },
  });
  expectStatus("bootstrapped admin can log in", 200, adminLogin.status);
  const adminToken = adminLogin.json.token;

  const adminAccess = await request("GET", "/api/admin/dashboard", { token: adminToken });
  expectStatus("bootstrapped admin can read the admin dashboard", 200, adminAccess.status);

  // --- duplicate admin protection ------------------------------------------
  const secondAdminEmail = `second_admin_${stamp}@example.com`;
  const duplicate = runCli(["--email", secondAdminEmail, "--display-name", "Second Admin"], forcePassword);
  ok("a second new admin is refused without --force", duplicate.status === 1, `status ${duplicate.status}`);
  ok("duplicate refusal explains --force", /--force/.test(duplicate.stderr), duplicate.stderr.trim());
  ok("refused duplicate admin was not created", (await User.findOne({ email: secondAdminEmail })) === null);
  ok("duplicate refusal leaves exactly one admin", (await User.countDocuments({ role: "admin" })) === 1);

  // --- promotion of an existing user ---------------------------------------
  const promoteEmail = `promote_${stamp}@example.com`;
  const promoteRegister = await request("POST", "/api/auth/register", {
    body: { email: promoteEmail, password: userPassword, displayName: "Promote Me" },
  });
  expectStatus("promotion target registers normally", 201, promoteRegister.status);
  ok("promotion target starts as user", promoteRegister.json.user?.role === "user");

  const implicitPromote = runCli(["--email", promoteEmail]);
  ok("an existing account is not promoted without --promote", implicitPromote.status === 1, `status ${implicitPromote.status}`);
  ok("account keeps role user after refusal", (await User.findOne({ email: promoteEmail }))?.role === "user");

  const promoted = runCli(["--email", promoteEmail, "--promote"]);
  ok("CLI promotes an existing account", promoted.status === 0, `status ${promoted.status}: ${promoted.stderr.trim()}`);
  ok("CLI reports the promotion", /Promoted existing account to admin/.test(promoted.stdout), promoted.stdout.trim());
  ok("promoted account now has role admin", (await User.findOne({ email: promoteEmail }))?.role === "admin");

  const promotedLogin = await request("POST", "/api/auth/login", {
    body: { email: promoteEmail, password: userPassword },
  });
  expectStatus("promoted account can log in", 200, promotedLogin.status);
  const promotedAccess = await request("GET", "/api/admin/dashboard", { token: promotedLogin.json.token });
  expectStatus("promoted account can read the admin dashboard", 200, promotedAccess.status);

  // --- promoting a missing account -----------------------------------------
  const missingPromote = runCli(["--email", `missing_${stamp}@example.com`, "--promote"]);
  ok("promoting a missing account is refused", missingPromote.status === 1, `status ${missingPromote.status}`);
  ok("missing-account refusal explains how to create one", /Omit --promote/.test(missingPromote.stderr), missingPromote.stderr.trim());

  // --- --force creates an additional admin ---------------------------------
  const forcedEmail = `forced_admin_${stamp}@example.com`;
  const forced = runCli(["--email", forcedEmail, "--force", "--display-name", "Forced Admin"], forcePassword);
  ok("--force creates an additional admin", forced.status === 0, `status ${forced.status}: ${forced.stderr.trim()}`);
  ok("--force does not print the password", !cliOutput(forced).includes(forcePassword));
  ok("forced account has role admin", (await User.findOne({ email: forcedEmail }))?.role === "admin");
} catch (error) {
  ok("test run completes without an unexpected exception", false, error.message);
} finally {
  try {
    if (server.listening) await new Promise((resolve) => server.close(resolve));

    // Compare before closing the baseline connection: mongoose.disconnect()
    // tears down the default connection and would make this read fail.
    if (baselineConnection) {
      const currentUsers = baselineConnection.db.collection("users");
      const current = {
        total: await currentUsers.countDocuments({}),
        admins: await currentUsers.countDocuments({ role: "admin" }),
      };
      ok("application database user count is unchanged", current.total === baseline.total, `before ${baseline.total}, after ${current.total}`);
      ok("application database admin count is unchanged", current.admins === baseline.admins, `before ${baseline.admins}, after ${current.admins}`);
    }

    if (testConnection) {
      const testDb = testConnection.name;
      if (testDb.startsWith("muhurtham_test_")) {
        await testConnection.dropDatabase();
      } else {
        ok("cleanup completed safely", false, `refusing to drop non-test database: ${testDb}`);
      }
    }
    await mongoose.disconnect().catch(() => {});
    if (baselineConnection) await baselineConnection.close().catch(() => {});
  } catch (error) {
    ok("cleanup completed safely", false, error.message);
  }
}

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
