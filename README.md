# Muhurtham — Ceremony Cash Gift Collection

A gift-collection desk for weddings and family celebrations: record each gift,
print A6 receipts and A4 entries lists, and keep a permanent per-account
history. Ships as a React SPA plus an Express/MongoDB backend.

## Stack

- **Frontend**: React 19 + Vite 8, `react-router-dom` v7, Tailwind CSS v4
  (`@tailwindcss/vite`), `lucide-react` icons, `@dnd-kit` drag-to-reorder
- **Backend** (`backend/`): Express 5, Mongoose (MongoDB), Zod validation,
  JWT sessions, optional Google OAuth (authorization code + PKCE)
- **Storage**: local disk uploads (`backend/uploads/`)

## Quick start

```sh
# 1. Frontend
npm install
cp .env.example .env        # adjust if the API is not on :3005
npm run dev                 # http://localhost:5173

# 2. Backend (separate terminal)
cd backend
npm install
cp .env.example .env        # set MONGO_URI + JWT_SECRET (min 32 chars)
npm run dev                 # http://localhost:3005
```

Requires a running MongoDB (default `mongodb://127.0.0.1:27017/muhurtham`).

Google sign-in is optional: leave `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
empty in `backend/.env` and the "Continue with Google" button hides itself.
To enable it, create an OAuth client at
https://console.cloud.google.com/apis/credentials with redirect URI
`http://localhost:3005/auth/google/callback`.

## Scripts

```sh
npm run dev            # Vite dev server
npm run dev:backend    # backend dev server (nodemon)
npm run build          # production build to dist/
npm run preview        # preview the production build
npm run lint           # oxlint
npm run test:backend   # backend unit tests
```

Backend-only: `cd backend && npm test` (unit) and
`npm run test:integration` (needs a running server on :3005 + MongoDB).

## Routes (frontend)

| Path               | Screen            |
| ------------------ | ----------------- |
| `/`                | Dashboard         |
| `/collection`      | Collection form   |
| `/receipt-preview` | Receipt preview   |
| `/receipt-designer`| Receipt designer  |
| `/entries-history` | Entries history   |
| `/function-setup`  | Function setup    |
| `/calendar`        | Scheduled + completed functions |
| `/completed`       | Completed (archived) functions  |
| `/register`        | Sign up           |
| `/login`           | Sign in           |
| `/auth/callback`   | Google OAuth return |

## Backend API

All under `/api` unless noted. Auth via `Authorization: Bearer <JWT>`.

- `POST /api/auth/register`, `POST /api/auth/login`, `GET|PATCH /api/auth/me`
- `GET /api/auth/google/status`, `POST /api/auth/login/google`
- `GET /auth/google` → redirect, `GET /auth/google/callback` (outside `/api`)
- `GET|POST /api/functions`, `PATCH|DELETE /api/functions/:id`,
  `POST /api/functions/:id/open|close|reopen|recompute|clear-entries`
- `GET|POST /api/entries`, `PATCH|DELETE /api/entries/:id`
- `GET|POST /api/designs`, `PATCH|DELETE /api/designs/:id`,
  `POST /api/designs/:id/default|duplicate`
- `POST /api/uploads`, `GET /api/uploads/info`, `DELETE /api/uploads/:key`
- `GET /api/dashboard`, `GET /api/admin/dashboard`

## Structure

```
src/
  main.jsx                          BrowserRouter + AuthProvider + CeremonyProvider
  App.jsx                           route table
  index.css                         design tokens + all custom classes
  contexts/AuthContext.jsx          session (login/register/Google/logout)
  lib/api.js                        axios client + token storage
  lib/ceremony-api.js               typed wrappers over the backend API
  lib/tamil-transliteration.js      dictionary/phonetic Tamil conversion
  components/RequireAuth.jsx        route guards
  components/ceremony-provider.jsx  app state (functions, entries, designs, language)
  components/ceremony/*-screen.jsx  one file per screen
backend/src/
  app.js                            express app + route mounting
  routes/                           auth, functions, entries, designs, uploads, google
  services/                         business logic (auth, function, entry, design, storage)
  models/                           Mongoose schemas
```

## State & persistence

Everything is server-backed: functions, entries, receipt designs and uploads
are stored in MongoDB via the API and reloaded on sign-in. The UI language
(EN/தமிழ்) and dark mode persist to `localStorage`; the auth JWT lives in
`localStorage` under `muhurtham-auth-token`.
