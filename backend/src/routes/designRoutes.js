import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate, createDesignSchema, updateDesignSchema } from "../utils/validation.js";
import designService from "../services/designService.js";

const router = Router();
router.use(authenticate);

router.get("/designs", designService.listDesigns);
router.post("/designs", validate(createDesignSchema), designService.createDesign);
router.get("/designs/:id", designService.getDesign);
router.patch("/designs/:id", validate(updateDesignSchema), designService.updateDesign);
router.delete("/designs/:id", designService.deleteDesign);
router.post("/designs/:id/default", designService.setDefaultDesign);
router.post("/designs/:id/duplicate", designService.duplicateDesign);

export default router;