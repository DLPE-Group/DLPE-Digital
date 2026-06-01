# START HERE — Intelligence Layer (local quickstart)

Fleet-operations console for the DLPE Group: a **Vite + React** frontend (`app/`), an
**Express + Prisma + Postgres** API (`server/`), and shared contracts (`packages/shared`),
wired together as an npm-workspaces monorepo.

> Built across three phases by Claude Code on the web; this file is your hand-off to
> continue locally. Full architecture is in `/.claude/plans/` notes and `docs/DEPLOY.md`.

---

## 0. Prerequisites

- **Node 22** (`node -v` → v22.x) — argon2 + Prisma build against it
- **Docker Desktop running** (provides Postgres + Adminer via the dev compose file)
  - …or your own Postgres, with `DATABASE_URL` pointed at it
- This repo cloned, on branch **`main`** (has everything)

---

## 1. Create your `.env` (required — it is gitignored, so not in the clone)

```bash
cp .env.example .env
```

Defaults already match the bundled Postgres, so you can leave it as-is for local dev.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — any non-empty strings are fine locally
- `ANTHROPIC_API_KEY` — optional; **empty → reports use the scripted fallback** (still works)
- **Keep `NODE_ENV=development`** so Vite serves the UI (production mode serves the static build instead)

---

## 2. First run

```bash
docker compose up -d     # Postgres :5432 (+ Adminer :8080)
npm install              # installs all workspaces
npm run db:migrate       # applies migrations AND generates the Prisma client
npm run db:seed          # loads the demo data (users, cards, RBAC rules, reports…)
npm run dev              # API :4000 + Vite :5173 (proxies /api -> :4000)
```

Open **http://localhost:5173** → sign in:

| Login | Password | Role |
|---|---|---|
| `m.weber@group.eu` | `demo1234` | Sales manager (multi-company) |
| `r.mertens@group.eu` | `demo1234` | Group admin (see admin + RBAC) |

(All seeded users use `demo1234`.)

---

## 3. Confirm it's really wired (not mock)

- **Pipelines** load from the API, not seed constants.
- **Brussels cascade:** click the **"Sign" demo** on the Brussels Energy deal → new Ops +
  Finance cards appear → **reload the page** → they persist (proves Postgres, not React state).
- **RBAC:** Admin → Roles → *Configure* a role → **Preview as user**. As `sales-rep`,
  contract **bank account + margin disappear**; as `ops-coord`, contract value shows
  `€XXX,XXX`. This is enforced **server-side** (check the `/api/records/...` response).
- **Reports:** generate one — works with or without an Anthropic key.
- **Audit:** the cascade entry has a **Revert** that transactionally undoes it.

---

## 4. Handy commands

```bash
npm run dev            # run API + frontend together (dev)
npm run db:reset       # wipe + re-migrate + re-seed (fresh demo state)
npm run build          # production build (server bundle + app dist)
npm --workspace server run typecheck   # tsc --noEmit
```

Production / Docker deploy: see **`docs/DEPLOY.md`** (single-container build, the API
serves the SPA, `prisma migrate deploy` runs on boot).

---

## 5. Status & what's left

**Done & on `main` (DLPE-Group/DLPE-Digital):**
- **Phase 1** — JWT auth, Postgres schema + seed, pipelines, server-driven Brussels
  cascade (transactional, trigger-rule based), AI reports (Anthropic + scripted fallback)
- **Phase 2** — server-enforced field-level RBAC + preview-as, all admin editors persist
  (users, roles/field-rules, stage config, cross-triggers, org structure, data sharing),
  audit revert
- **Phase 3** — production build (tsup bundle), helmet + rate-limiting + pino logging +
  CORS lockdown, SPA served by the API, Dockerfile + `docker-compose.prod.yml`

**Deliberately deferred:**
- **Nango stays simulated** (mock integration data) — by design
- **Managed auth (Clerk/Auth0)** — not built; the JWT `AuthProvider` seam in
  `server/src/auth/` is ready to slot one in without touching routes
- Aggregation perf optimization (fine at current data size)
- The Dockerfile is authored but was **not build-tested** (no Docker daemon in the
  build environment) — give it a `docker compose -f docker-compose.prod.yml up --build` to confirm

---

## 6. Gotchas

- `.env` is **not** in the repo (secrets) — you must `cp .env.example .env` (step 1).
- If `npm run dev` can't reach the DB: ensure `docker compose up -d` is running and
  `DATABASE_URL` matches it.
- First `db:migrate` also generates the Prisma client; if you ever see a Prisma client
  error, run `npx --workspace server prisma generate`.
- Theme + language persist in `localStorage` (intentional); everything else is server-side.
