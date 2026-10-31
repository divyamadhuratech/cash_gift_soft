/**
 * WhatsApp service using @whiskeysockets/baileys.
 *
 * Baileys speaks the WhatsApp binary WebSocket protocol directly —
 * no Puppeteer, no Chrome, no browser automation.
 *
 * One-time setup: the first time the server starts a QR code is produced.
 * Scan it once with your phone (WhatsApp → Linked Devices → Link a Device).
 * The session is saved to ./wa_auth_info/ and reused on every subsequent start.
 */

import baileys from "@whiskeysockets/baileys";
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = baileys;
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Folder where Baileys stores auth keys between restarts. */
const AUTH_DIR = path.join(__dirname, "..", "..", "wa_auth_info");

let sock = null;
let ready = false;
/** Latest raw QR string — set on each "qr" credential update, cleared on connect. */
let pendingQr = null;

/** Returns the current WhatsApp connection state for API consumers. */
export function getWhatsAppStatus() {
  return { ready, hasQr: Boolean(pendingQr), qr: pendingQr };
}

export function isWhatsAppReady() {
  return ready && sock !== null;
}

/** Converts the current pending QR string into a base64 PNG data URL. */
export async function getQrDataUrl() {
  if (!pendingQr) return null;
  return QRCode.toDataURL(pendingQr, { width: 256, margin: 2 });
}

export async function initWhatsApp() {
  if (sock) return sock;

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys),
    },
    // Suppress the noisy Baileys console logger
    logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: (msg) => console.warn("[baileys]", msg), error: (msg) => console.error("[baileys]", msg), fatal: (msg) => console.error("[baileys]", msg), child: () => ({ trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {} }) },
    printQRInTerminal: true,
    browser: ["Muhurtham", "Chrome", "1.0.0"],
  });

  // Persist credentials whenever they change (QR scan, key rotation, etc.)
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      pendingQr = qr;
      console.log("WhatsApp QR code generated — scan it in WhatsApp > Linked Devices.");
    }

    if (connection === "open") {
      ready = true;
      pendingQr = null;
      console.log("WhatsApp client ready");
    }

    if (connection === "close") {
      ready = false;
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : 0;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `WhatsApp connection closed (code ${statusCode}).`,
        shouldReconnect ? "Reconnecting…" : "Logged out — delete wa_auth_info/ and restart to re-link.",
      );

      if (shouldReconnect) {
        // Reset so initWhatsApp() creates a fresh socket on next call
        sock = null;
        // Delay slightly to avoid hammering the server on rapid disconnects
        setTimeout(() => initWhatsApp(), 3000);
      } else {
        sock = null;
      }
    }
  });

  return sock;
}

export async function sendWhatsAppReceipt({ phone, message }) {
  if (!sock || !ready) {
    throw new Error("WhatsApp client is not ready — please scan the QR code first.");
  }

  // Normalise: strip all non-digits, then ensure country code (default +91 India)
  const digits = String(phone).replace(/\D/g, "");
  // If the number starts with 0 strip it; if it's 10 digits assume India (+91)
  const normalised = digits.startsWith("91") && digits.length === 12
    ? digits
    : digits.length === 10
      ? `91${digits}`
      : digits;

  const jid = `${normalised}@s.whatsapp.net`;

  await sock.sendMessage(jid, { text: message });

  return { success: true };
}
