import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate, googleLoginSchema, loginSchema, registerSchema } from "../utils/validation.js";
import * as authService from "../services/authService.js";

const router = Router();

// Public routes
router.post("/register", validate(registerSchema), authService.register);
router.post("/login", validate(loginSchema), authService.login);
router.post("/login/google", validate(googleLoginSchema), authService.loginWithGoogle);
/** Lets the login screen decide whether to show the Google button at all. */
router.get("/google/status", (_req, res) => res.json({ configured: authService.googleStatus() }));

// Protected routes
router.get("/me", authenticate, authService.me);
router.patch("/me", authenticate, authService.updateProfile);

export default router;