# WhatsApp Connect (QR) — Code Review & Portability Report

> Scope: the QR-based WhatsApp linking and receipt-sending feature as implemented in this
> repository, frontend and backend.
> Purpose: explain how it is written, what APIs/tokens it uses, and whether it will run unchanged
> on another machine/deployment.

---

## 1. Executive verdict

**Short answer:** There are **no API keys, tokens, or env variables** to copy. The feature links a
real WhatsApp account by scanning a **QR code** (WhatsApp → Linked Devices), using the unofficial
`@whiskeysockets/baileys` library. It is portable to another system **only if that system**:

1. Runs a **single, long-lived Node.js process** (18+).
2. Has a **persistent, writable disk** for `backend/wa_auth_info/` (session keys).
3. Has **outbound internet** to WhatsApp servers (and for `fetchLatestBaileysVersion`).
4. Has someone available to **scan the QR with a real phone once per deployment**.
5. Allows an **unofficial WhatsApp client** (ToS/ban risk — not the official WhatsApp Business API).

It will **NOT** work as-is on:
- serverless / ephemeral containers (session lost, no persistent socket),
- multiple replicas sharing/duplicating the auth folder,
- read-only filesystems,
- environments blocking WhatsApp WebSockets.

Also note the architectural fact: the backend holds **one shared WhatsApp session for the entire
app**, not one per user/workspace. Every logged-in user sends through the same linked phone number.

---

## 2. File map (manual verification order)

### Backend (`backend/src/`)

| # | File | What to verify |
|---|------|----------------|
| 1 | `backend/package.json` | `@whiskeysockets/baileys@6.7.18`, `qrcode@1.5.4`; **`@hapi/boom` is imported but not declared** |
| 2 | `backend/src/services/whatsapp.js` | Entire lifecycle: auth dir, socket, QR, reconnect, send |
| 3 | `backend/src/routes/whatsappRoutes.js` | `/status`, `/reset`, `/send-receipt` (all JWT-protected) |
| 4 | `backend/src/server.js` | `initWhatsApp()` on boot |
| 5 | `backend/src/app.js` | Mounts routes at `/api` (line 85) |
| 6 | `backend/src/middleware/auth.js` | Bearer JWT required for every WhatsApp route |
| 7 | `backend/.gitignore` | `wa_auth_info/` ignored (contains account credentials) |

### Frontend (`src/`)

| # | File | What to verify |
|---|------|----------------|
| 1 | `src/lib/ceremony-api.js` | `whatsappApi.status/sendReceipt/reset` (67–75) |
| 2 | `src/components/ceremony/collection-screen.jsx` | State (47–52), polling/reset (90–122), send-on-save (254–276), QR/status UI (356–406) |

There is **no dedicated `WhatsAppScreen` file** — the QR panel lives inside the collection form.

---

## 3. How the logic is written

### 3.1 Startup

`backend/src/server.js:4-9`

```js
startServer();
initWhatsApp().catch((err) => console.error("WhatsApp init failed:", err?.message || err));
```

- The HTTP server starts regardless. If WhatsApp init fails, it is only logged — **there is no automatic
  retry for an init failure** (e.g. no internet at boot). A restart is needed.
- WhatsApp runs in the same process as the API (not a worker/queue).

### 3.2 The WhatsApp service state

`whatsapp.js:30-37`

```js
const AUTH_DIR = path.join(__dirname, "..", "..", "wa_auth_info"); // backend/wa_auth_info
let sock = null;          // Baileys socket
let ready = false;        // true after connection "open"
let pendingQr = null;     // latest raw QR string while linking
let reconnectTimer = null;
```

All state is **module-global singletons** shared by every HTTP request and every user.

### 3.3 Initialisation and QR generation

`whatsapp.js:79-151`

1. `initWhatsApp()` returns the existing socket if one exists.
2. `useMultiFileAuthState(AUTH_DIR)` loads saved credentials or starts fresh.
3. `fetchLatestBaileysVersion()` — network call to learn the current WhatsApp Web protocol version.
   If this fails, `initWhatsApp()` rejects (logged by `server.js`).
4. `makeWASocket(...)` with:
   - `version`,
   - cached auth keys,
   - a mostly-silent custom logger,
   - `printQRInTerminal: true` (QR also printed in the server terminal),
   - `browser: ["Muhurtham", "Chrome", "1.0.0"]`.
5. `creds.update` → `saveCreds` persists keys to disk.
6. `connection.update` handler:
   - `qr` present → `pendingQr = qr` (the frontend polls and receives a PNG data URL).
   - `connection === "open"` → `ready = true`, `pendingQr = null`.
   - `connection === "close"` →
     - `ready = false`, `pendingQr = null`,
     - classify `lastDisconnect` status code,
     - fatal codes (`loggedOut`, `badSession`, `forbidden`, `multideviceMismatch`) → **wipe
       `wa_auth_info/`** so a fresh registration QR is generated,
     - schedule re-init in 3s (or 5s if fatal), guarded so overlapping timers cannot stack.

### 3.4 QR retrieval for the frontend

`whatsapp.js:40-52`

- `getWhatsAppStatus()` → `{ ready, hasQr, qr }` (internal use).
- `getQrDataUrl()` → `QRCode.toDataURL(pendingQr, { width: 256, margin: 2 })` (base64 PNG).
- The route (`whatsappRoutes.js:18-26`) only converts when `hasQr`, and returns
  `{ ready, hasQr, qrDataUrl }` — the raw QR string is **not** exposed over HTTP.

### 3.5 Reset / disconnect

`whatsapp.js:63-77`

1. Clear any pending reconnect timer.
2. `sock.end()` on the current socket.
3. Reset `ready`/`pendingQr`/`sock`.
4. Recursively delete `wa_auth_info/`.
5. `initWhatsApp()` again → new QR.

### 3.6 Sending a receipt

`whatsapp.js:153-172`

1. Refuse if `!sock || !ready`.
2. Normalise the phone:
   - strip every non-digit,
   - 10 digits → prefix `91` (India),
   - 12 digits starting `91` → keep,
   - any other length → use as-is.
3. JID = `${normalised}@s.whatsapp.net`.
4. `sock.sendMessage(jid, { text: message })` → `{ success: true }`.

**It sends text only.** The frontend builds a short text summary; the printed receipt image/PDF is
**not** sent.

### 3.7 HTTP routes

`whatsappRoutes.js`

```js
router.use(authenticate);                       // every route needs a valid app JWT
GET  /api/whatsapp/status        → { ready, hasQr, qrDataUrl }
POST /api/whatsapp/reset         → re-init + fresh QR
POST /api/whatsapp/send-receipt  → { phone, message } → text message
```

- `send-receipt` returns 400 if `phone` missing, 503 if not ready.
- `message` is **not validated** (presence/length) — authenticated-only, but still worth noting.

### 3.8 Frontend behaviour

`collection-screen.jsx`

- `whatsappApi.status()` polls every **5s** while not ready (lines 118–122); the poller stops once
  `ready` (127–133).
- "Disconnect" button is shown when `ready`; it calls `/reset` and restarts the poller.
- QR `<img>` is shown while `!ready && qrDataUrl` (373–381), with a manual Refresh button.
- The guest number input is disabled until ready.
- On save (254–276): if a number was entered and WhatsApp is ready, it sends the text message and
  shows a toast on success/failure. On failure it re-fetches status once.
- If the connection drops while the poller is stopped, the UI can stay stale until a send failure or
  a manual Disconnect/refresh — a minor UX gap.

---

## 4. Tokens, credentials, and what is actually stored

| Item | Where it comes from | Where it is stored | Notes |
|------|---------------------|--------------------|-------|
| WhatsApp session keys (`creds.json`, signal keys) | Created when the QR is scanned | `backend/wa_auth_info/` on disk | **These are live account credentials**; gitignored; back them up securely and never commit |
| QR string | WhatsApp → Baileys | memory (`pendingQr`), converted to PNG | Short-lived; regenerated |
| App JWT | This backend | `localStorage` (frontend) | Required to call the routes |
| API keys / tokens for WhatsApp | **None** | — | Uses device linking, not the official Cloud API |

There is **no `WHATSAPP_*` env var** anywhere. Configuration is: filesystem path + a scanned phone.

---

## 5. Environment & runtime requirements (the real "env")

| Requirement | Why |
|-------------|-----|
| Node.js 18+ | Baileys and modern syntax/APIs |
| Single backend process | One socket + one in-memory session; two replicas = conflicts |
| Persistent writable disk for `backend/wa_auth_info/` | Keeps the link across restarts |
| Ability to delete that folder | `reset` and fatal-disconnect recovery wipe it |
| Outbound HTTPS/WSS to WhatsApp | Linking, QR, sending, version fetch |
| A phone with WhatsApp | Must scan the QR and keep the device linked |
| Permission to use an unofficial client | Baileys is not the official WhatsApp Business API (ToS/ban risk) |

No additional databases, queues, or paid services are required.

---

## 6. Will it work on another system unchanged?

### Works unchanged when ALL of these are true

- Same code + `npm install` in `backend/` (Baileys `6.7.18`, `qrcode`).
- Single Node process, persistent disk, outbound internet.
- Someone scans the QR once after deployment.
- The linked phone stays linked (not logged out from "Linked Devices").
- The app JWT auth is working (routes are protected).

### Needs manual work / does not work when

| Situation | Result | What to do |
|-----------|--------|------------|
| Serverless / ephemeral FS | Link lost on every cold start; QR every time | Use a persistent VM/container; mount a volume |
| Multiple replicas | Socket fights, duplicate logins, folder corruption | Run **one** WhatsApp worker; or move to a dedicated service |
| Read-only filesystem | Cannot save session or wipe on reset | Mount a writable volume |
| Scale to many users | All users share one WhatsApp number | One session per tenant is **not implemented**; needs separate workers/services |
| International numbers | 10-digit numbers get `+91`; other lengths pass through raw | Change `sendWhatsAppReceipt` normalisation |
| Need official API compliance | Unofficial client may be blocked/banned | Rebuild on WhatsApp Cloud/Business API (different code + tokens) |
| Baileys protocol drift | WhatsApp changes can break older versions | Upgrade Baileys and retest; pin is `6.7.18` |
| `npm` without hoisting / `pnpm` strict | `@hapi/boom` import fails (only a transitive dep) | Add `@hapi/boom` to `backend/package.json` explicitly |
| Docker | Session lost unless volume-mounted | `-v .../backend/wa_auth_info:/app/backend/wa_auth_info` and **one** replica |
| Hot reload / multiple `nodemon` restarts | Repeated re-init; may race on auth files | Restart cleanly; ensure only one process touches the folder |

### Verdict

- **A normal single-server deployment with a disk:** portable with **zero code changes** and **zero
  tokens/env** — just scan the QR once.
- **Cloud/serverless/multi-tenant/multi-replica:** **not** portable as-is; architectural changes are
  required (persistent volume + single worker; per-tenant sessions if needed).

---

## 7. Security & operational notes

- `wa_auth_info/` is effectively a password to the WhatsApp account. It is gitignored, but:
  - do not copy it into images/build artifacts,
  - restrict file permissions,
  - if leaked, unlink the device from the phone.
- Every WhatsApp route requires a valid app JWT, but **any authenticated user** can:
  - see the shared connection status,
  - trigger a reset (which disconnects everyone),
  - send messages from the linked number.
  There is no role check / per-workspace isolation.
- No rate limiting specific to sending, no message queue, no retry/backoff, no delivery receipts,
  no audit log of who sent what.
- `send-receipt` does not validate `message`; a logged-in user could send arbitrary text. Consider
  schema validation and length caps.
- `resetWhatsApp` is a global destructive action exposed to every user.
- Unofficial library → account-ban risk. Do not link a number you cannot afford to lose.

---

## 8. Manual verification checklist for a new system

1. `cd backend && npm install` (confirm `@whiskeysockets/baileys` installed).
2. Start the backend; watch the terminal for a QR (also `printQRInTerminal` logs it).
3. Open the collection screen; the poller shows the same QR as a PNG within ~5s.
4. On the phone: WhatsApp → **Linked Devices → Link a Device** → scan.
5. UI flips to **Connected**; the poller stops; the number input enables.
6. Enter a guest number (10-digit Indian or full country code) and save an entry → the linked phone
   sends the text summary; toast confirms.
7. Restart the backend → still Connected without a new QR (session persisted).
8. Click **Disconnect** → connection ends, `wa_auth_info/` wiped, a new QR appears.
9. Log out the device from the phone's Linked Devices → backend logs a fatal code, wipes the
   session, and generates a new QR automatically.
10. Send before linking → 503 "scan the QR first".
11. Send with an invalid/foreign number → confirm the `+91` assumption and adjust if needed.
12. Confirm `backend/wa_auth_info/` exists after linking and is **not** committed to git.
13. If Docker: confirm the folder is on a mounted volume and replicas = 1.

---

## 9. Bottom line for your manual combination work

- The feature is **small and self-contained**: one service file, one routes file, one frontend
  panel. There is no external API key or OAuth app to create.
- The hard dependencies are operational, not code: **single process + persistent disk + QR scan +
  internet**.
- Before reusing this in another product, decide:
  1. Is one shared WhatsApp number acceptable? (currently yes)
  2. Is an unofficial library acceptable? (ToS/ban risk)
  3. Does the host give a persistent writable disk and a single instance?
  4. Which country's phone numbers must be supported? (`+91` is hard-coded for 10-digit numbers)
- If the answers are "shared number, unofficial is okay, single server with disk, India" → it will
  work unchanged on another system after one QR scan.
