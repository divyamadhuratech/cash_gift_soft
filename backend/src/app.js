import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import env from "./config/env.js";
import { connectDB } from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import googleAuthRoutes from "./routes/googleAuthRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import functionRoutes from "./routes/functionRoutes.js";
import designRoutes from "./routes/designRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import whatsappRoutes from "./routes/whatsappRoutes.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { storageRoot } from "./services/storage/index.js";

export function createApp() {
  const app = express();

  // Security & observability. crossOriginResourcePolicy must be relaxed or the
  // Vite dev origin cannot load logo/background images served from /uploads.
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  app.use(cookieParser());

  // Static assets produced by the storage driver.
  app.use(env.UPLOAD_PUBLIC_PATH, express.static(storageRoot, { maxAge: env.NODE_ENV === "production" ? "7d" : 0, fallthrough: true }));

  // Rate limiting
  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS);
  const max = Number(env.RATE_LIMIT_MAX);
  app.use(
    "/api/",
    rateLimit({
      windowMs: Number.isFinite(windowMs) ? windowMs : 900000,
      max: Number.isFinite(max) ? max : 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests, please try again later" },
    }),
  );

  // Body parsing. Raised from 1mb because designs carry data URLs until uploaded.
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok", env: env.NODE_ENV, storage: env.STORAGE_DRIVER });
  });

  // API routes
  app.use("/api/auth", authRoutes);

  // Google's authorization-code flow lives outside /api: Google redirects the
  // browser straight to it, and GOOGLE_REDIRECT_URI must match it exactly.
  app.use(
    "/auth",
    rateLimit({
      windowMs: Number.isFinite(windowMs) ? windowMs : 900000,
      max: Number.isFinite(max) ? max : 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests, please try again later" },
    }),
  );
  app.use("/auth", googleAuthRoutes);

  app.use("/api/admin", adminRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/api", functionRoutes);
  app.use("/api", designRoutes);
  app.use("/api", uploadRoutes);
app.use("/api", whatsappRoutes);

  // Error handling
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export async function startServer() {
  try {
    await connectDB();
    const app = createApp();
    const port = Number(env.PORT) || 3005;
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port} (${env.NODE_ENV})`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

export default createApp;