# Nexus

A full-stack social platform with posts, DMs, groups, servers, reels, real-time notifications, and more.

## Run & Operate

- `pnpm --filter @workspace/nexus run dev` — run the frontend dev server
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + shadcn/ui (`artifacts/nexus/`)
- API: Express 5 (`artifacts/api-server/`)
- DB: PostgreSQL + Drizzle ORM (`lib/db/`)
- Real-time: Server-Sent Events (SSE)
- Push notifications: web-push + VAPID

## Where things live

- `artifacts/nexus/` — React frontend (pages, components, hooks)
- `artifacts/api-server/src/routes/` — Express API routes
- `lib/db/src/schema/index.ts` — Drizzle DB schema (source of truth)
- `artifacts/nexus/vite.config.ts` — Vite config (PORT and BASE_PATH default to 5173 and /)

## Deploying to Render

Use `render.yaml` at the root for one-click deployment.

**Build command (Render):**
```
npm install -g pnpm@10.26.1 --prefix=/tmp/pnpm && export PATH=/tmp/pnpm/bin:$PATH && pnpm install && pnpm --filter @workspace/nexus run build && pnpm --filter @workspace/api-server run build
```

> **Important:** Paste this directly into **Settings → Build & Deploy → Build Command** in the Render dashboard — Render ignores render.yaml for services created via the dashboard.

**Start command:** `node artifacts/api-server/dist/index.mjs`

**Required env vars on Render:**
- `DATABASE_URL` — your Postgres connection string (use Render's managed Postgres or external)
- `SESSION_SECRET` — a long random string
- `NODE_ENV=production` (auto-set in render.yaml)
- Optional: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL` for push notifications

After first deploy, run the DB migration to create tables:
```
pnpm --filter @workspace/db run push
```
(Run this locally pointing at your production DATABASE_URL, or via a Render shell)

## Architecture decisions

- Single web service on Render: the Express backend builds and serves the Vite frontend as static files in production
- All API routes are prefixed with `/api/` — the frontend catches all other routes for client-side routing
- SSE used for real-time events (notifications, messages, typing indicators, calls)
- Sessions stored server-side with express-session (cookie-based, httpOnly, secure in production)
- File uploads stored in `uploads/` directory (ephemeral on Render free tier — use object storage for persistence)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The vite.config.ts no longer requires PORT/BASE_PATH — they default to 5173 and / respectively
- In production, the Express server serves the built frontend from `artifacts/nexus/dist/`
- The `uploads/` directory is ephemeral on Render's free tier — uploaded files will be lost on redeploy

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
