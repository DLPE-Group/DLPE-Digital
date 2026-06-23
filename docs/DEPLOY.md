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
| `APP_DATABASE_URL` | **yes in production** | Non-superuser (`il_app`) connection string used to serve requests with RLS enforced. **Must differ from `DATABASE_URL`** — in `production` the app refuses to boot if it's unset or equal (otherwise RLS is bypassed). Empty is allowed only in dev/test, where it falls back to `DATABASE_URL`. |

Copy `.env.example` → `.env` and fill in secrets. **Never commit `.env`** (gitignored).

## First-time production bootstrap (the first platform admin)

A fresh production database has **no users**. The slim runtime image cannot run the
demo seed (`prisma db seed` needs `src/` + tsx), and you do **not** want the demo data
in production anyway. Instead, after migrations have run, create the first platform
admin with the bundled, idempotent command (it ships in the runtime image):

```bash
# Against the running app container (DigitalOcean: use the App Platform console):
BOOTSTRAP_ADMIN_EMAIL=you@company.com \
BOOTSTRAP_ADMIN_PASSWORD='<strong-password>' \
BOOTSTRAP_ADMIN_NAME='Your Name' \
  npm run bootstrap:admin            # == node dist/scripts/bootstrap-admin.js
```

It creates a `platform` tenant + a `platformAdmin` user (and removes the empty
`dlpe-demo` placeholder that the tenant-backfill migration leaves on a fresh DB — it
only deletes it when it has no users, so a real seeded demo is never touched). Log in
with that account and use the **Control plane** to provision real customers from the
`dlpe-starter` (config-only) blueprint — no per-customer deploy needed.

> Optional: to also have the full demo dataset in a non-prod environment, run
> `npm run db:seed` from a source checkout (not the slim image) pointed at that database.

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

## Database roles

The migration `20260618190000_app_role` creates a non-superuser role `il_app` that is used (once RLS is enabled in Task 6) to serve all API requests. It has `LOGIN` and table-level `SELECT/INSERT/UPDATE/DELETE` grants but no `SUPERUSER` or `BYPASSRLS`.

**Local dev:** the role is created with password `il_app_pw` by the migration and also by `docker/initdb/01_app_role.sql` on fresh volume init.

**DigitalOcean Managed Postgres (and any hosted provider):** do **not** use the literal `il_app_pw` password. Create the role manually (or via a one-off migration) and store its password in a secret manager. Set `APP_DATABASE_URL` to the full connection string (including the secret password) in your environment / Secret.

```bash
# Example: create il_app on DigitalOcean after connecting as the admin user
CREATE ROLE il_app LOGIN PASSWORD '<secret-from-vault>';
GRANT USAGE ON SCHEMA public TO il_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO il_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO il_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO il_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO il_app;
```

## Notes

- **Auth** is custom JWT today, behind an `AuthProvider` seam — a managed provider
  (Clerk/Auth0) can be slotted in later without touching routes.
- The commit-signing wrapper in some managed environments may need configuring;
  commits here were made unsigned.
