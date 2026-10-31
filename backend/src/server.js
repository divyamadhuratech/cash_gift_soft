import { startServer } from "./app.js";
import { initWhatsApp } from "./services/whatsapp.js";

startServer();

// Baileys init is async — errors are logged but must not crash the HTTP server.
initWhatsApp().catch((err) => {
  console.error("WhatsApp init failed:", err?.message || err);
});
