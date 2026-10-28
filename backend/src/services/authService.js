import bcrypt from "bcrypt";
import crypto from "node:crypto";
import User from "../models/User.js";
import Workspace from "../models/Workspace.js";
import { signToken } from "../utils/jwt.js";
import { GoogleTokenError, verifyGoogleIdToken } from "../utils/google-id.js";
import env from "../config/env.js";

/**
 * Workspace.slug is uniquely indexed but used to be derived from displayName,
 * so any two accounts sharing a name (two "Karthik"s) collided on register and
 * surfaced as an opaque 500. Email is unique per user, so derive the slug from
 * it and add a hash suffix for the case where two emails share a local part.
 */
const workspaceSlugFor = (email) => {
  const base = String(email).split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = crypto.createHash("sha1").update(String(email).toLowerCase()).digest("hex").slice(0, 8);
  return `${base || "workspace"}-${suffix}`;
};

const publicUser = (user) => ({
  id: user._id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
  workspace: user.workspace,
});

/** Every new account gets its own tenant workspace. */
const provisionAccount = async ({ email, displayName, password, role, provider, googleId, picture }) => {
  const workspace = await Workspace.create({
    name: displayName ? `${displayName}'s workspace` : `${email}'s workspace`,
    slug: workspaceSlugFor(email),
    owner: null, // set after user creation
  });

  const user = await User.create({
    email,
    password,
    displayName,
    role,
    provider,
    googleId,
    picture,
    workspace: workspace._id,
  });

  workspace.owner = user._id;
  await workspace.save();
  return user;
};

export const register = async (req, res) => {
  try {
    const { email, password, displayName, role: requestedRole } = req.validated;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    /**
     * The admin area must never be openable by an arbitrary self-registered
     * account, so "admin" is only ever granted to the very first account that
     * asks for it. After that, admin is a database-side decision.
     */
    const adminTaken = requestedRole === "admin" && (await User.exists({ role: "admin" }));
    const role = adminTaken ? "user" : requestedRole;

    const hashed = await bcrypt.hash(password, 10);
    const user = await provisionAccount({ email, displayName, password: hashed, role, provider: "local" });

    const token = signToken({ userId: user._id, email: user.email, role: user.role });

    return res.status(201).json({
      message: "Account created successfully",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern ?? {})[0] ?? "account";
      return res.status(409).json({ message: `That ${field} is already registered` });
    }
    console.error("Register error:", error);
    return res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.validated;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // An account created through Google has no password at all. Comparing
    // against a missing hash would throw a 500, so say what actually happened.
    if (!user.password) {
      return res.status(401).json({ message: "This account signs in with Google. Use Continue with Google instead." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken({ userId: user._id, email: user.email, role: user.role });

    return res.status(200).json({
      message: "Login successful",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
};

/** Whether both halves of the Google OAuth client are present. */
export const googleStatus = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Raised when verified Google claims belong to a suspended account. */
export class AccountSuspendedError extends Error {
  constructor() {
    super("This account has been suspended.");
    this.name = "AccountSuspendedError";
  }
}

/**
 * Turns verified Google claims into a session. Shared by both Google flows —
 * the authorization-code redirect and the browser credential endpoint — so the
 * account rules can never drift between them.
 *
 * First sign-in with an address that already registered a password links the
 * two (Google has already proved control of that mailbox), so nobody ends up
 * with two accounts for one email.
 */
export const signInWithGoogleClaims = async (claims) => {
  const email = String(claims.email).toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: claims.sub }, { email }] });

  if (user) {
    if (user.status === "suspended") throw new AccountSuspendedError();
    let changed = false;
    if (!user.googleId) { user.googleId = claims.sub; changed = true; }
    if (!user.displayName && claims.name) { user.displayName = claims.name; changed = true; }
    if (!user.picture && claims.picture) { user.picture = claims.picture; changed = true; }
    user.lastLogin = new Date();
    await user.save();
    if (changed) console.log(`Linked Google identity for ${email}`);
  } else {
    user = await provisionAccount({
      email,
      displayName: claims.name ?? "",
      password: undefined,
      role: "user",
      provider: "google",
      googleId: claims.sub,
      picture: claims.picture ?? "",
    });
    user.lastLogin = new Date();
    await user.save();
  }

  return { token: signToken({ userId: user._id, email: user.email, role: user.role }), user };
};

/**
 * "Continue with Google" via the Google Identity Services credential: the
 * browser hands over a JWT Google signed, verified against Google's keys
 * before anything is trusted from it.
 */
export const loginWithGoogle = async (req, res) => {
  try {
    const { credential } = req.validated ?? req.body;

    if (!env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ message: "Google sign-in is not configured on this server." });
    }

    let claims;
    try {
      claims = await verifyGoogleIdToken(credential, env.GOOGLE_CLIENT_ID);
    } catch (error) {
      if (error instanceof GoogleTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const { token, user } = await signInWithGoogleClaims(claims);
    return res.status(200).json({ message: "Login successful", token, user: publicUser(user) });
  } catch (error) {
    if (error instanceof AccountSuspendedError) return res.status(403).json({ message: error.message });
    if (error?.code === 11000) {
      // A password account was created with this address between the lookup
      // and the insert — link instead of failing the sign-in.
      return res.status(409).json({ message: "That email is already registered. Sign in with your password once, then with Google." });
    }
    console.error("Google login error:", error);
    return res.status(500).json({ message: "Google sign-in failed", error: error.message });
  }
};

export const me = async (req, res) => {
  try {
    const user = req.user;
    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        workspace: user.workspace,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch user", error: error.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { displayName } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (displayName !== undefined) user.displayName = displayName;
    const saved = await user.save();

    return res.status(200).json({
      user: {
        id: saved._id,
        email: saved.email,
        displayName: saved.displayName,
        role: saved.role,
        workspace: saved.workspace,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Update failed", error: error.message });
  }
};

export default { register, login, loginWithGoogle, me, updateProfile };