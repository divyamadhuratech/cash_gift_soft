import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      // Optional: an account created through Google has no password at all.
      // The password login route refuses such accounts instead of comparing
      // against a missing hash.
      required: false,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    /** Google's stable subject id, set on the first Google sign-in. */
    googleId: {
      type: String,
      trim: true,
      default: null,
      index: true,
      sparse: true,
    },
    /** Which sign-in method created the account. */
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    picture: {
      type: String,
      trim: true,
      default: "",
    },
    displayName: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
    // SaaS tenant: each user owns their workspace
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);

export default User;