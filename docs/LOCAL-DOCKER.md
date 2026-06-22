# Local production-parity stack (Docker)

Run DLPE almost exactly as it runs on **DigitalOcean App Platform + DO Managed Postgres**, on your laptop. Use this to test what the real deployment will do before you deploy.

## What's 1:1 with DigitalOcean
- **Same image** — built from the same multi-stage `Dockerfile`; the API serves the built SPA (one service, one port), just like the App Platform service.
- **`NODE_ENV=production`** and `prisma migrate deploy` runs on container start (same as DO).
- **Tenant isolation is real** — requests are served over the non-superuser **`il_app`** role with `APP_DATABASE_URL` set, so Postgres RLS is enforced and the **production boot guard** is active (the app refuses to start if `APP_DATABASE_URL` is missing/owner-equal or the role can bypass RLS). This is the exact runtime path DO uses.

## What's local-only (the differences)
- Postgres runs as a container (`il_local_pg`) instead of DO Managed Postgres. Exposed on host **`localhost:5433`** for inspection (DO's would be private).
- Secrets are obvious placeholders (`local-only-...`). **Generate real `JWT_SECRET`/`JWT_REFRESH_SECRET` and rotate the `il_app` password for any real deploy.**
- Runs in its **own compose project (`dlpe-local`)**, fully isolated from the dev `docker-compose.yml` stack (`il_postgres`) — they never disturb each other.

## Quickstart
```bash
# from the repo root
docker compose -f docker-compose.local.yml up --build -d        # build + boot (first run ~2-4 min)
docker compose -f docker-compose.local.yml --profile seed run --rm seed   # load the demo (run once)
open http://localhost:4000
```
Log in with the demo accounts (password `demo1234`):
- `r.mertens@group.eu` — **platform admin** (sees the Control plane: provision/suspend tenants, blueprints, billing)
- `m.weber@group.eu`, `l.pieters@group.eu`, … — regular roles

Optional DB UI:
```bash
docker compose -f docker-compose.local.yml --profile tools up -d adminer
# http://localhost:8082  — System: PostgreSQL, Server: postgres, User: postgres, Pass: postgres, DB: intelligence
```

## Everyday commands
```bash
docker compose -f docker-compose.local.yml logs -f app          # tail app logs
docker compose -f docker-compose.local.yml restart app          # restart the API
docker compose -f docker-compose.local.yml down                 # stop (KEEPS the database volume)
docker compose -f docker-compose.local.yml down -v              # stop + WIPE the database
docker compose -f docker-compose.local.yml up --build -d        # rebuild after code changes
```
After `down -v` (fresh DB), re-run the `--profile seed` step to reload the demo.

## What to test (exercises the real multi-tenant path)
1. **Log in as `r.mertens@group.eu`** → open **Control plane**.
2. **Provision a second customer** via the guided wizard (pick a published blueprint, set its admin email + plan, review the preflight, provision). You now have two isolated tenants.
3. **Prove isolation**: log in as the new tenant's admin (the invite link / the email you set) and confirm you see **only that tenant's** data — none of the demo's users, roles, vehicles, reports, etc. This is Postgres RLS doing the work, exactly as it will on DO.
4. **Billing/limits, blueprints, capture** — all run against the production code path.

## Going to real DigitalOcean (from here)
The strict reference is `docker-compose.prod.yml` (same topology, no baked secrets). For DO App Platform:
- Build from the `Dockerfile` (auto-deploy on push).
- Add a DO Managed Postgres (EU) and set, as App-level secrets: `DATABASE_URL` (owner), `APP_DATABASE_URL` (the **`il_app`** role — created by the `app_role` migration; **rotate its password** from `il_app_pw`), `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `CORS_ORIGIN` if you split the SPA off.
- `APP_DATABASE_URL` is a **hard launch gate** (see `docs/DEPLOYMENT-RULES.md` rule 9): if it's unset the app won't boot, by design, so RLS can never be silently bypassed in production.
- Seed the demo once (`prisma db seed`) **or** provision your first real customer through the Control plane — no code deploy needed per customer.
```
