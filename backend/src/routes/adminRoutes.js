import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as adminService from "../services/adminService.js";

const router = Router();

// Admin-only routes
router.use(authenticate);
router.use(authorize("admin"));

router.get("/dashboard", adminService.getAdminDashboard);

export default router;