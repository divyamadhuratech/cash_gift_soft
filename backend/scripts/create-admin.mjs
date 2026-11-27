#!/usr/bin/env node
/**
 * Controlled admin bootstrap.
 *
 * Public registration can only create `user` accounts. This CLI is the only
 * supported way to create the first admin or promote an existing account:
 *
 *   npm --prefix backend run create-admin -- --email owner@example.com
 *   npm --prefix backend run create-admin -- --email owner@example.com --promote
 *   npm --prefix backend run create-admin -- --email other@example.com --force
 *
 * Password for a new account is read from ADMIN_BOOTSTRAP_PASSWORD or entered
 * at a hidden prompt. It is never accepted as a command-line argument and is
 * never printed.
 */
import bcrypt from "bcrypt";
import { connectDB, disconnectDB } from "../src/config/database.js";
import User from "../src/models/User.js";
import { provisionAccount } from "../src/services/authService.js";

const USAGE = `Usage:
  node scripts/create-admin.mjs --email <email> [--display-name "<name>"]
  node scripts/create-admin.mjs --email <email> --promote
  node scripts/create-admin.mjs --email <email> --force [--display-name "<name>"]

Options:
  --email <email>        Account email (required)
  --display-name <name>  Display name for a new account
  --promote              Grant admin to an existing account (no password change)
  --force                Allow creating an additional admin when one already exists
  --help                 Show this message

Password for a new account comes from ADMIN_BOOTSTRAP_PASSWORD or a hidden prompt.`;

const fail = (message) => {
  console.error(`create-admin: ${message}`);
  process.exitCode = 1;
};

const parseArgs = (argv) => {
  const options = { email: "", displayName: "", promote: false, force: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--promote") {
      options.promote = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--email") {
      options.email = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--display-name") {
      options.displayName = argv[index + 1] ?? "";
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
};

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Reads a password without echoing it. Only used for an interactive terminal. */
const promptHidden = (question) => new Promise((resolve, reject) => {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    reject(new Error("Set ADMIN_BOOTSTRAP_PASSWORD when not running in a terminal."));
    return;
  }

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  let value = "";
  const cleanup = () => {
    process.stdin.removeListener("data", onData);
    process.stdin.setRawMode(false);
    process.stdin.pause();
  };

  const onData = (chunk) => {
    for (const char of chunk) {
      if (char === "\u0003") {
        cleanup();
        process.stdout.write("\n");
        process.exit(130);
      }
      if (char === "\r" || char === "\n") {
        cleanup();
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
        continue;
      }
      value += char;
    }
  };

  process.stdin.on("data", onData);
});

const readNewPassword = async () => {
  const fromEnv = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (fromEnv) return fromEnv;

  const first = await promptHidden("Admin password: ");
  const second = await promptHidden("Confirm password: ");
  if (first !== second) throw new Error("Passwords do not match.");
  return first;
};

const main = async () => {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error.message);
    console.error(USAGE);
    return;
  }

  if (options.help) {
    console.log(USAGE);
    return;
  }

  const email = String(options.email).trim().toLowerCase();
  if (!validEmail(email)) {
    fail("Provide a valid --email address.");
    console.error(USAGE);
    return;
  }

  await connectDB();
  try {
    const existing = await User.findOne({ email });

    if (existing) {
      if (!options.promote) {
        fail(`An account already exists for ${email}. Re-run with --promote to grant admin.`);
        return;
      }
      if (existing.role === "admin") {
        console.log(`Unchanged: ${email} is already an admin.`);
        return;
      }
      existing.role = "admin";
      await existing.save();
      console.log(`Promoted existing account to admin: ${email}`);
      return;
    }

    if (options.promote) {
      fail(`No account exists for ${email}. Omit --promote to create one.`);
      return;
    }

    if (!options.force && (await User.exists({ role: "admin" }))) {
      fail("An admin already exists. Re-run with --force to create an additional admin.");
      return;
    }

    const password = await readNewPassword();
    if (typeof password !== "string" || password.length < 8) {
      fail("Password must be at least 8 characters.");
      return;
    }

    const hashed = await bcrypt.hash(password, 10);
    await provisionAccount({
      email,
      displayName: String(options.displayName).trim(),
      password: hashed,
      role: "admin",
      provider: "local",
    });
    console.log(`Created admin account: ${email}`);
  } finally {
    await disconnectDB().catch(() => {});
  }
};

main().catch((error) => {
  fail(error.message);
  process.exitCode = 1;
});
