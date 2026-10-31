import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  sendWhatsAppReceipt,
  isWhatsAppReady,
  getWhatsAppStatus,
  getQrDataUrl,
} from "../services/whatsapp.js";

const router = Router();
router.use(authenticate);

/**
 * GET /api/whatsapp/status
 * Returns { ready, hasQr, qrDataUrl } — polled by the frontend every few seconds.
 */
router.get("/whatsapp/status", async (req, res) => {
  try {
    const { ready, hasQr } = getWhatsAppStatus();
    const qrDataUrl = hasQr ? await getQrDataUrl() : null;
    res.json({ ready, hasQr, qrDataUrl });
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to get WhatsApp status" });
  }
});

/**
 * POST /api/whatsapp/send-receipt
 * Body: { phone: string, message: string }
 */
router.post("/whatsapp/send-receipt", async (req, res) => {
  try {
    const { phone, message } = req.body || {};
    if (!phone) {
      return res.status(400).json({ message: "phone is required" });
    }
    if (!isWhatsAppReady()) {
      return res
        .status(503)
        .json({ message: "WhatsApp client is not ready. Please scan the QR code first." });
    }
    const result = await sendWhatsAppReceipt({ phone, message });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error?.message || "Failed to send WhatsApp receipt" });
  }
});

export default router;
