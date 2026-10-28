import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../utils/validation.js";
import { createEntrySchema, createFunctionSchema, updateEntrySchema, updateFunctionSchema } from "../utils/validation.js";
import functionService from "../services/functionService.js";
import entryService from "../services/entryService.js";

const router = Router();
router.use(authenticate);

router.get("/functions", functionService.listFunctions);
router.post("/functions", validate(createFunctionSchema), functionService.createFunction);
router.get("/functions/:id", functionService.getFunction);
router.patch("/functions/:id", validate(updateFunctionSchema), functionService.updateFunction);
router.delete("/functions/:id", functionService.deleteFunction);
router.post("/functions/:id/open", functionService.openFunction);
router.post("/functions/:id/close", functionService.closeFunction);
router.post("/functions/:id/reopen", functionService.reopenFunction);
router.post("/functions/:id/recompute", functionService.recomputeTotals);
router.post("/functions/:id/clear-entries", entryService.purgeFunctionEntries);

router.get("/entries", entryService.listEntries);
router.post("/entries", validate(createEntrySchema), entryService.createEntry);
router.get("/entries/:id", entryService.getEntry);
router.patch("/entries/:id", validate(updateEntrySchema), entryService.updateEntry);
router.delete("/entries/:id", entryService.deleteEntry);

export default router;