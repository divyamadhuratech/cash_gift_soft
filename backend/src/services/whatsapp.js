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
  // Baileys' factory just happens to share the "use" prefix with React hooks —
  // alias it so the hook rules don't mistake it for one.
  useMultiFileAuthState: createAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
} = baileys;
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Folder where Baileys stores auth keys between restarts. */
const AUTH_DIR = path.join(__dirname, "..", "..", "wa_auth_info");

let sock = null;
let ready = false;
/** Latest raw QR string — set on each "qr" credential update, cleared on connect. */
let pendingQr = null;
/** Guard so rapid close events can't spawn multiple overlapping reconnect timers. */
let reconnectTimer = null;

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

/** Recursively removes the auth directory so Baileys starts a fresh registration. */
async function wipeAuthDir() {
  await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
}

/**
 * Disconnects the current socket, clears all credentials, and re-initialises
 * so a brand-new QR code is generated. Call this from the "Disconnect" button.
 */
export async function resetWhatsApp() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  const current = sock;
  sock = null;
  ready = false;
  pendingQr = null;
  if (current) {
    try { current.end(undefined); } catch { /* socket already closed */ }
  }
  await wipeAuthDir();
  await initWhatsApp();
}

export async function initWhatsApp() {
  if (sock) return sock;

  const { state, saveCreds } = await createAuthState(AUTH_DIR);
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

  sock.ev.on("connection.update", async (update) => {
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
      pendingQr = null;
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output.statusCode
        : 0;

      // Fatal codes mean the saved session can never work again — wiping the
      // auth directory makes Baileys fall back to the registration flow so a
      // fresh QR is generated automatically.
      const fatalCodes = new Set([
        DisconnectReason.loggedOut,
        DisconnectReason.badSession,
        DisconnectReason.forbidden,
        DisconnectReason.multideviceMismatch,
      ]);
      const isFatal = fatalCodes.has(statusCode);

      console.log(
        `WhatsApp connection closed (code ${statusCode}).`,
        isFatal ? "Session invalid — resetting and generating a new QR…" : "Reconnecting…",
      );

      if (isFatal) {
        await wipeAuthDir();
      }
      sock = null;
      // Clear any pending reconnect timer before scheduling a new one.
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        initWhatsApp();
      }, isFatal ? 5000 : 3000);
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
