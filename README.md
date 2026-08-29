# Google Review Link Generator

A web app for generating and managing **dynamic QR codes** that route scans to a configurable destination URL — built for collecting Google Business reviews and other marketing redirects.

Admins create QR codes, assign each one a destination (e.g. your Google review link), and print/display the static QR. Later, the destination can be changed at any time without reprinting the code, because scans are resolved server-side on each request.

## Features

- **Dynamic QR codes** — every code has a stable ID and a server-side destination, so you can update where it points without reprinting.
- **Bulk generation** — generate as many QR codes as you need at once (up to 500 per batch) with a single click.
- **Permanent sequence numbers** — every QR code gets a fixed, unique sequence number (`#0`, `#1`, `#2`, …) that never changes, even after other codes are deleted.
- **Admin dashboard** — log in, view all QR codes, create new ones, and edit their destination/business name.
- **Active / Non-Active filters** — a status tab in the management panel tells you at a glance which QR codes are live (destination assigned) and which still need setup.
- **Scan redirection** — visitors who scan a code hit `/scan/:id` and are securely redirected to the assigned destination.
- **Link extraction** — paste a Google Maps / business URL and the API resolves a clean review link without requiring any API keys.
- **Safe redirects** — destination URLs are validated before redirecting to prevent open-redirect abuse.
- **Supabase backed** — QR codes are stored in a Postgres table; the table is protected by Row Level Security and only accessed server-side via the `service_role` key.

## Tech Stack

- **Frontend:** React 19, React Router 8, Tailwind CSS 4, Vite 6, lucide-react, motion, qrcode.react
- **Backend:** Express 4 (local dev server) + Vercel serverless functions for production
- **Database:** Supabase (Postgres) with RLS; accessed via `@supabase/supabase-js`
- **Language:** TypeScript

## Project Structure

```
.
├── api/                      # Vercel serverless functions
│   ├── _lib/                 # Shared server logic (db, link extraction, scan page)
│   ├── admin-login.js
│   ├── bulk-generate.js      # POST — create many QR codes in one request
│   ├── extract-link.js
│   ├── qr-links.js           # GET list / POST create
│   ├── qr-links/[id].js      # GET / PUT / DELETE single link
│   └── scan/[id].js          # QR scan redirect
├── src/                      # React frontend
│   ├── App.tsx               # Router, admin login, QR setup screens
│   ├── Dashboard.tsx         # Admin management panel
│   ├── main.tsx
│   └── index.css
├── server.ts                 # Local Express dev server (mirrors the Vercel API)
├── supabase/
│   └── migrations/           # SQL migrations (qr_links table)
├── vite.config.ts
├── vercel.json
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Your Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key (server-side only). Bypasses RLS. Keep it secret. |
| `ADMIN_USERNAME` | Yes | Username for the admin dashboard login. |
| `ADMIN_PASSWORD` | Yes | Password for the admin dashboard login. |
| `APP_URL` | No | Public URL where the app is hosted (used for generating absolute links). |
| `GEMINI_API_KEY` | No | Required only for Gemini AI features. |
| `GOOGLE_MAPS_API_KEY` | No | Required only for Google Maps Places search / link extraction. The basic link extractor works without it. |

### 3. Set up the database

Run the SQL migration files in **Supabase Dashboard → SQL Editor**, in order:

1. [`supabase/migrations/0001_create_qr_links.sql`](supabase/migrations/0001_create_qr_links.sql) — creates the `qr_links` table, enables Row Level Security (with no public policies), and seeds a couple of sample codes.
2. [`supabase/migrations/0002_add_sequence_number.sql`](supabase/migrations/0002_add_sequence_number.sql) — adds the `sequence_number` column used for permanent, non-repeating numbering of QR codes.

### 4. Run the dev server

```bash
npm run dev
```

The app starts on `http://localhost:3000` (or `PORT` if set). Vite serves the frontend in middleware mode and Express handles the `/api/*` routes.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the local Express + Vite dev server. |
| `npm run build` | Build the production frontend bundle to `dist/`. |
| `npm run lint` | Type-check the project with `tsc --noEmit`. |

## Deployment (Vercel)

1. Import the repo into Vercel.
2. Set the same environment variables from `.env.example` in the Vercel project settings.
3. `vercel.json` is preconfigured:
   - `buildCommand`: `vite build`
   - `outputDirectory`: `dist`
   - Rewrites `/scan/:id` → `/api/scan/:id` and SPA fallback to `index.html`.

The `api/` functions run as serverless endpoints in production, replacing the local Express server.

## How It Works

1. **Create QR codes** — In the admin dashboard, create a single dynamic QR (stable ID like `qr_<random>`) or use **Bulk Generate** to create many at once. Every code gets a permanent `sequence_number` starting where the last one left off, so numbering never repeats.
2. **Point a scanner at it** — Generate a QR encoding `https://<your-app>/scan/qr_<random>`.
3. **Resolve on scan** — When someone scans, `/scan/:id` looks up the destination in Supabase, validates it, and redirects them there.
4. **Manage status** — In the management panel, filter by **Active** (destination assigned) or **Non-Active** (needs setup). Codes without a destination redirect to a setup page when scanned.
5. **Update anytime** — Change the destination in the dashboard; the printed QR never needs to change, and its sequence number stays the same.

## Security Notes

- The `qr_links` table uses RLS with **no public policies**. The browser never talks to Supabase directly — all access goes through server code using the `service_role` key.
- Redirect destinations are validated with `isSafeRedirectUrl` to block open-redirect attacks.
- Admin credentials are checked against `ADMIN_USERNAME` / `ADMIN_PASSWORD` and never exposed to the client. Do not commit real secrets; use `.env` (already gitignored).
