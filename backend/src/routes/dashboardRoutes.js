import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as dashboardService from "../services/dashboardService.js";

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/dashboard - summary metrics for the authenticated user
router.get("/dashboard", dashboardService.getDashboard);

export default router;