# Deploying the Intelligence Layer

The app is a monorepo: a **Vite + React** frontend (`app/`), an **Express + Prisma**
API (`server/`), and shared contracts (`packages/shared`). In production the API
serves the built frontend, so it ships as **one container** plus Postgres.

> Nango remains **simulated** (mock integration data). Everything else — auth, the
> pipelines, the cross-track cascade, RBAC enforcement, reports — runs for real.

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | yes | sign access/refresh tokens |
| `NODE_ENV` | — | `production` enables static SPA serving, JSON logs, CORS lockdown |
| `ANTHROPIC_API_KEY` | no | empty → reports use the scripted fallback |
| `ANTHROPIC_MODEL` | no | default `claude-sonnet-4-6` |
| `CORS_ORIGIN` | no | comma-separated allowlist; empty = same-origin only |
| `STATIC_DIR` | no | path to `app/dist`; the image sets it |
| `PORT` | no | default `4000` |

Copy `.env.example` → `.env` and fill in secrets. **Never commit `.env`** (gitignored).

## Local development

```bash
docker compose up -d          # Postgres on :5432 (+ Adminer on :8080)
npm install
npm run db:migrate            # apply migrations
npm run db:seed               # load the demo data
npm run dev                   # API :4000 + Vite :5173 (proxied /api)
```

Open http://localhost:5173 and sign in with `m.weber@group.eu` / `demo1234`.

## Production (Docker)

```bash
# Provide secrets via env or a .env file picked up by compose:
export JWT_SECRET=... JWT_REFRESH_SECRET=... ANTHROPIC_API_KEY=...
docker compose -f docker-compose.prod.yml up --build
```

This builds the frontend + API, starts Postgres, runs `prisma migrate deploy`
automatically on boot, and serves the whole app on **http://localhost:4000**.

> First boot creates the schema but does **not** seed demo data. To seed a fresh
> production database once:
> `docker compose -f docker-compose.prod.yml exec app npm run db:seed`

## Production build without Docker

```bash
npm --workspace app run build       # -> app/dist
npm --workspace server run build    # -> server/dist (bundled, standalone)
cd server
NODE_ENV=production \
  DATABASE_URL=... JWT_SECRET=... JWT_REFRESH_SECRET=... \
  STATIC_DIR="$(cd ../app/dist && pwd)" \
  npm run start:prod                # migrate deploy + node dist/index.js
```

## Hardening in place

- `helmet` security headers, `express-rate-limit` (strict on `/api/auth/login`,
  global on `/api`), `pino-http` structured request logging (auth header redacted).
- CORS reflects only `CORS_ORIGIN` in production (same-origin by default).
- Zod-validated env at boot (`server/src/env.ts`) — the process exits on bad config.

## Notes

- **Auth** is custom JWT today, behind an `AuthProvider` seam — a managed provider
  (Clerk/Auth0) can be slotted in later without touching routes.
- The commit-signing wrapper in some managed environments may need configuring;
  commits here were made unsigned.
