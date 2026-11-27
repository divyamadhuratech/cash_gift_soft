# Muhurtham API Collection

Reference for every backend endpoint of the ceremony cash-gift app. Use it with
Postman, Insomnia, Bruno or any HTTP client. An importable Postman v2.1
collection lives next to this file: [`api-collection.postman_collection.json`](./api-collection.postman_collection.json).

## Basics

| | |
|---|---|
| Base URL | `http://localhost:3005` (dev, `PORT` in `backend/.env`) |
| Auth | `Authorization: Bearer <token>` — JWT returned by `POST /api/auth/register` or `POST /api/auth/login` |
| Content type | `application/json` (uploads use `multipart/form-data`) |
| Rate limit | 100 requests / 15 min per IP on `/api/*`; uploads: 60 / 15 min |
| Body size limit | `JSON_BODY_LIMIT` env (designs carry data URLs, so it is raised above the 1 MB default) |

Universal error shape:

```json
{ "message": "Human readable reason", "errors": { "field": ["Zod message"] } }
```

`errors` appears only on validation failures (HTTP 400). `401` = missing/expired
token, `403` = not admin, `404` = wrong id, `409` = conflict, `429` = rate limit.

---

## Health

### `GET /health` (public)

```json
{ "status": "ok", "env": "development", "storage": "local" }
```

---

## Auth — `/api/auth`

### `POST /api/auth/register` (public)

```json
{ "email": "karthik@example.com", "password": "secret123", "displayName": "Karthik" }
```

Registration always creates a `user` account. Unknown fields, including an
explicit `role`, are rejected by strict validation. Admin accounts are created
or promoted only with `backend/scripts/create-admin.mjs` (`npm run create-admin`).
**201**

```json
{ "message": "Account created successfully", "token": "<jwt>", "user": { "id": "...", "email": "...", "displayName": "...", "role": "user", "workspace": "<workspaceId>" } }
```

**400** — validation failure, including any `role` field.
**409** — `Email already registered`.

### `POST /api/auth/login` (public)

```json
{ "email": "karthik@example.com", "password": "secret123" }
```

**200** — same shape as register. **401** for wrong credentials, or
`"This account signs in with Google. Use Continue with Google instead."` for
Google-only accounts.

### `POST /api/auth/login/google` (public)

```json
{ "credential": "<Google Identity Services id_token>" }
```

**200** — same shape as register.

### `GET /api/auth/google/status` (public)

```json
{ "configured": true }
```

### `GET /api/auth/me` (auth)

Returns `{ message, user }`.

### `PATCH /api/auth/me` (auth)

```json
{ "displayName": "New name", "password": "newsecret123" }
```

Both fields optional; returns the updated user.

### Google OAuth browser flow (no CORS — browser redirects)

1. `GET /auth/google` → redirects to Google consent (PKCE + state cookie).
2. `GET /auth/google/callback` → exchanges the code, then redirects to
   `<FRONTEND_URL>/auth/callback#token=<jwt>` (or `#error=<reason>`).
   `GOOGLE_REDIRECT_URI` in `backend/.env` must match this callback exactly.

---

## Dashboard

### `GET /api/dashboard` (auth)

```json
{
  "message": "Dashboard data",
  "summary": {
    "totalUsers": 2, "totalWorkspaces": 1, "totalFunctions": 5,
    "totalEntries": 120, "totalCollection": 45200,
    "paymentMix": { "Cash": 21000, "UPI": 18000, "Card": 4200, "Other": 2000 }
  },
  "user": { "id": "...", "email": "...", "displayName": "...", "role": "user" }
}
```

---

## Functions (ceremony events) — `/api/functions`

A "function" is one ceremony (wedding, engagement…). One owner may have only
**one open collection** at a time (`collectionOpenAt`). One owner may not have
two **non-archived functions with the same name and date** — duplicates return
HTTP **200 with `duplicate: true`** and the existing record instead of 201.

### `GET /api/functions` (auth)

Query params (all optional):

| Param | Example | Meaning |
|---|---|---|
| `archived` | `false` / `true` | non-archived (calendar) or archived (completed) |
| `status` | `Upcoming` | `Active` / `Upcoming` / `Completed` |
| `from` / `to` | `2026-11-01` / `2026-11-30` | date range (`date` is `YYYY-MM-DD`) |
| `workspace` | `<workspaceId>` | filter by workspace |

```json
{ "message": "Functions loaded", "functions": [ /* array, sorted by date asc */ ] }
```

### `POST /api/functions` (auth)

```json
{
  "name": "madhu&ramesh",
  "tamil": "",
  "type": "Wedding",
  "category": "Family celebration",
  "venue": "townhall",
  "date": "2026-11-20",
  "organizer": "Karthik",
  "targetCollection": 100000,
  "language": "Both",
  "status": "Upcoming",
  "entryFields": [
    { "key": "name", "label": "Guest Name", "type": "text", "required": true, "builtin": true, "removable": false },
    { "key": "giftType", "label": "Gift Type", "type": "select", "options": ["Cash", "Silver"], "required": false }
  ],
  "inviteeGroups": ["Groom side", "Bride side", "Friends"]
}
```

- `name` required (≤120 chars); `date` must be `YYYY-MM-DD` (or empty string);
  `type` ∈ Wedding, Engagement, Birthday, Housewarming, Temple, Anniversary, Custom.
- `status` is optional — derived from `date` when omitted.
- **201** `{ "message": "Function created", "function": { ... } }`
- **200** `{ "message": "Function already exists", "function": { ... }, "duplicate": true }`
  when the same (owner, name, date) already exists non-archived — test double-POSTs with this.
- **409** `A function with this name and date already exists` only when a race
  beats the index and the loser could not be looked up.

### `GET /api/functions/:id` (auth)

`{ "message": "Function loaded", "function": { ... } }` · **404** if not yours.

### `PATCH /api/functions/:id` (auth)

Same fields as create, all optional. `date` change re-derives `status`.
**409** if the new name+date collides with another function of yours.

### `DELETE /api/functions/:id` (auth)

Deletes the function **and its gift entries**. `{ "message": "Function deleted" }`.

### Session endpoints (auth)

| | | |
|---|---|---|
| `POST /api/functions/:id/open` | claims the one open-collection slot | **200** or **409** `Close "<other>" before opening another collection…` |
| `POST /api/functions/:id/close` | archives (`status: Completed`, `archived: true`) and frees the slot | |
| `POST /api/functions/:id/reopen` | un-archives; slot stays free until `open` | |
| `POST /api/functions/:id/recompute` | rebuilds `entryCount` / `collectedTotal` | `{ "count": 12, "total": 5400 }` |
| `POST /api/functions/:id/clear-entries` | deletes all entries of this function | destructive |

Every response with a function echoes the full record.

---

## Entries (gifts) — `/api/entries`

Each entry is one guest's gift. Receipt numbers are unique per
`(owner, function, receipt)` and auto-generated as `R-0101…` per function.

### `GET /api/entries` (auth)

Query: `function=<functionId>`, `mode=Cash|UPI|Card|Other`, `limit` (default 200, max 1000), `skip`.

```json
{ "message": "Entries loaded", "entries": [ /* newest first */ ], "total": 42 }
```

### `POST /api/entries` (auth)

```json
{
  "function": "<functionId>",
  "name": "Suresh Kumar",
  "city": "Madurai",
  "relation": "Uncle",
  "giftType": "Cash",
  "amount": 5000,
  "mode": "UPI",
  "receipt": "",
  "message": "Best wishes!",
  "custom": { "gotra": "Bharadwaja" },
  "paymentDetails": { "upiId": "suresh@okhdfc", "upiRef": "523144778890" }
}
```

- `name` and `amount` required. `receipt` optional — generated when empty.
  `time`/`date` default to now/today.
- If the target function is not open yet, **the first entry opens the collection
  session automatically** (unless another function holds the slot → **409**).
- **201** `{ "message": "Entry created", "entry": { ... } }`
- **409** `Receipt number already used` (duplicate receipt for same function)
- **400** `That function has not finished saving yet.` when `function` is not an
  ObjectId (client still on a local draft id).

### `GET /api/entries/:id`, `PATCH /api/entries/:id`, `DELETE /api/entries/:id` (auth)

PATCH takes any create field except `receipt` conflicts; function totals are
re-synced automatically. DELETE returns `{ "message": "Entry deleted" }`.

---

## Receipt designs — `/api/designs`

### `GET /api/designs` (auth)

Query: `function=<functionId>`, `template=Classic`. → `{ "designs": [...] }`

### `POST /api/designs` (auth)

```json
{
  "name": "Receipt design",
  "function": "<functionId>",
  "template": "Classic",
  "paper": "A6",
  "accent": "#b28e3e",
  "border": "double",
  "language": "Both",
  "elements": [
    { "id": "title", "name": "Title", "kind": "text", "english": "Shree Ganeshaya Namah", "visible": true, "order": 0 }
  ],
  "entriesDesign": { "sheet": "Plain A4", "columns": ["serial", "name", "amount"], "showTotals": true },
  "isDefault": false
}
```

→ **201** `{ "message": "Design created", "design": { ... } }`

### `GET /api/designs/:id`, `PATCH /api/designs/:id`, `DELETE /api/designs/:id` (auth)

### `POST /api/designs/:id/default` — make it the function's default (others unset)
### `POST /api/designs/:id/duplicate` — copy it

---

## Uploads — `/api/uploads`

### `GET /api/uploads/info` (auth) → `{ "driver": "local" }`

### `POST /api/uploads` (auth, `multipart/form-data`)

| Field | Type | Notes |
|---|---|---|
| `image` | file (binary) | required, image mime only |
| `folder` | text | optional, `logo` / `background` / `misc` (default) |

→ **201** `{ "message": "Image uploaded", "asset": { "url": "/uploads/logo/....png", ... } }`

### `POST /api/uploads/batch` (auth) — same but field `images`, up to 6 files → `{ "assets": [...] }`

### `DELETE /api/uploads/{*key}` (auth) — e.g. `/api/uploads/logo/abc.png` → `{ "message": "Asset deleted" }`

---

## WhatsApp — `/api/whatsapp`

| Endpoint | Body | Response |
|---|---|---|
| `GET /api/whatsapp/status` | — | `{ "ready": false, "hasQr": true, "qrDataUrl": "data:image/png;base64,..." }` |
| `POST /api/whatsapp/reset` | — | `{ "success": true }` (forces a fresh QR) |
| `POST /api/whatsapp/send-receipt` | `{ "phone": "919999999999", "message": "Receipt R-0101 …" }` | send result; **503** when client not ready |

---

## Admin

### `GET /api/admin/dashboard` (auth + role `admin`)

Platform-wide aggregates. Non-admins get **403**. There is no public route for
granting admin: use `cd backend && npm run create-admin -- --email <email>`
(create) or `--promote` (existing account).

---

## Suggested test order

1. `GET /health`
2. `POST /api/auth/register` → save `token` + `user.id`
3. `POST /api/functions` (madhu&ramesh, 2026-11-20) → expect **201**
4. Repeat the exact same POST → expect **200** + `duplicate: true`, and
   `GET /api/functions?archived=false` still lists it **once** (this is the
   regression test for the duplicate-calendar glitch)
5. `PATCH` the function, `POST /:id/open`, then `POST /api/entries` against it
6. `POST /:id/close`, then `GET /api/functions?archived=true`
7. `DELETE` leftovers you created
