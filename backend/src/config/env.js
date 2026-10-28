import "dotenv/config";
import zod from "zod";

const envSchema = zod.object({
  PORT: zod.string().default("3005"),
  NODE_ENV: zod.string().default("development"),
  MONGO_URI: zod.string().url("MONGO_URI must be a valid URL"),
  JWT_SECRET: zod.string().min(32, "JWT_SECRET must be at least 32 chars"),
  JWT_EXPIRES_IN: zod.string().default("7d"),
  CORS_ORIGIN: zod.string().default("http://localhost:5173"),
  RATE_LIMIT_WINDOW_MS: zod.string().default("900000"),
  RATE_LIMIT_MAX: zod.string().default("100"),

  // OAuth client for "Continue with Google". Optional: leaving the id empty
  // simply hides Google sign-in and password login keeps working. The secret is
  // only needed for the authorization-code flow (/auth/google + /callback).
  GOOGLE_CLIENT_ID: zod.string().trim().default(""),
  GOOGLE_CLIENT_SECRET: zod.string().trim().default(""),
  /** Must match a URI registered on the OAuth client, exactly. */
  GOOGLE_REDIRECT_URI: zod.string().url().default("http://localhost:3005/auth/google/callback"),
  /** Where Google sends the browser back to after a successful sign-in. */
  FRONTEND_URL: zod.string().url().default("http://localhost:5173"),

  // Binary asset storage. Only `local` is implemented; listing `s3` here
  // would silently fall back to disk, so keep it out until a driver exists.
  STORAGE_DRIVER: zod.enum(["local"]).default("local"),
  UPLOAD_DIR: zod.string().default("uploads"),
  UPLOAD_PUBLIC_PATH: zod.string().default("/uploads"),
  UPLOAD_MAX_BYTES: zod.string().default("5242880"),
  JSON_BODY_LIMIT: zod.string().default("8mb"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export default parsed.data;