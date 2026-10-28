import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/auth.js";
import { uploadImage, uploadImages } from "../middleware/upload.js";
import uploadService from "../services/uploadService.js";

const router = Router();
router.use(authenticate);

// Uploads are write-heavy and expensive; give them their own tighter budget.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many uploads, please wait a few minutes" },
});

router.get("/uploads/info", uploadService.storageInfo);
router.post("/uploads", uploadLimiter, uploadImage, uploadService.uploadOne);
router.post("/uploads/batch", uploadLimiter, uploadImages, uploadService.uploadMany);
router.delete("/uploads/{*key}", uploadService.deleteUpload);

export default router;