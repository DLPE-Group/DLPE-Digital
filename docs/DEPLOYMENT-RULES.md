# Deployment Rules — for every future release

> **Purpose.** These are the standing rules that keep deploys safe as we grow from one
> deployment to many — including the eventual **dedicated single-tenant environments**
> that big customers will demand. The pain of running many dedicated environments comes
> almost entirely from **drift** (different code versions, hand-applied SQL, per-customer
> patches). Every rule below exists to prevent drift at the source.
>
> Adopt these **now**, while we still run one shared deployment. They cost nothing today
> and must be muscle memory before there is ever more than one environment to keep in step.
>
> Stack assumed: **DigitalOcean App Platform** (build from this GitHub repo's Dockerfile,
> auto-deploy on push) + **DigitalOcean Managed Postgres** (EU region). See `DEPLOY.md`
> for the mechanics; this file is the *discipline*.

---

## The cardinal rules

### 1. One image. Config only. Never fork code per customer.
Every environment — shared pool and every dedicated customer — runs the **byte-identical
container image** built from `main`. The *only* thing that differs between environments is
**configuration** (env vars: `DATABASE_URL`, tenant id, feature flags, secrets).

- A feature difference between customers is an **entitlement flag**, never a code branch.
  (Same `plans → entitlements` model as billing — it does double duty.)
- **Never** create a `customer-bigco` branch, a patched image, or an "if (tenant === X)"
  in code. The day you fork code per customer, every release becomes a merge nightmare and
  this whole document stops protecting you.

### 2. Migrations are forward-only and backward-compatible (expand / contract).
A migration must **never break the code version currently running.** Schema changes and
code deploys must be safe to apply in either order, because across many environments they
*will* happen in either order.

Use the **expand → migrate → contract** pattern, split across **separate releases**:

| Step | Release | Action |
|---|---|---|
| **Expand** | R1 | Add the new column/table. Nullable or defaulted. Old code ignores it. |
| **Migrate** | R1 | Deploy code that writes **both** old and new. Backfill existing rows. |
| **Contract** | R2 (later) | Once all environments run R1 and data is backfilled, remove the old column/code. |

Forbidden in a single release: rename a column, drop a column still read by live code,
add a `NOT NULL` column with no default, change a type in place. Each of those breaks a
rolling update. Do them as expand/contract across two releases instead.

### 3. Migrations are automated and identical. No human ever runs SQL by hand.
Every environment applies the **same ordered migration set** via `prisma migrate deploy`,
run automatically by the deploy pipeline on boot (already wired in `start:prod`).

- No manual `psql` schema changes. Ever. Hand-applied SQL is the #1 source of drift.
- No `prisma migrate dev`, no `migrate reset`, against any shared or customer database.
  Those are local-only.
- A migration that isn't in the repo and applied by the pipeline does not exist.

### 4. Deploy from `main` only, through the pipeline.
`main` is always releasable. Deploys happen by merging to `main` and letting DigitalOcean
build + deploy the image. No deploying from a laptop, no deploying an un-merged branch.

---

## Releasing across many environments (once dedicated environments exist)

These rules turn "scary update to a high-revenue customer" into a routine, low-risk event.

### 5. The shared pool is the permanent canary.
The multi-tenant **shared deployment always gets every release first.** With many small
tenants inside it, it is our largest and most diverse test bed. A bad migration surfaces
here — on low-revenue tenants — before it can ever reach a dedicated environment.

### 6. Stage the rollout. High-revenue customers go *last*.
Releases roll out in waves, each gated on health checks (errors, latency, migration
success) before the next wave starts:

```
shared pool  →  internal / test dedicated  →  small dedicated  →  big-revenue dedicated
   first                                                              last
```

Counter-intuitive but correct: your **most valuable customers run the most-baked release,
never the freshest.** Risk is inverted away from where the revenue is.

### 7. Back up before risky migrations; have a tested rollback.
DigitalOcean Managed Postgres gives point-in-time restore per database — keep it on.
Before a structurally risky migration against a high-value customer:

- Take/confirm a snapshot first.
- For anything non-trivial, **restore a copy of that customer's database and run the
  migration against their real data** before touching production.
- Because migrations are expand/contract (rule 2), the rollback for most releases is
  simply "deploy the previous image" — the schema still supports it.

### 8. Track what version every environment runs.
Maintain a registry (the future control plane) of every dedicated environment and its
current image version + last-applied migration. You cannot safely roll out to a fleet you
can't see. Until that exists, no more than a handful of dedicated environments by hand.

---

## Runtime tenant isolation

### 9. Production MUST set `APP_DATABASE_URL` to the non-superuser `il_app` connection string. **[Launch gate]**

The server keeps two Postgres connections: the owner/superuser (`DATABASE_URL`) used only
for migrations and provisioning, and the non-superuser app connection (`APP_DATABASE_URL`)
used for every request. Request handlers call `withTenant(tenantId, db => …)`, which sets
`app.tenant = <id>` on the session and then issues all queries through the `APP_DATABASE_URL`
connection. Postgres Row-Level Security policies on every tenant-scoped table enforce that
`il_app` can only see rows whose `tenantId` matches the session setting.

**If `APP_DATABASE_URL` is unset, `appDatabaseUrl` falls back to `DATABASE_URL`** (see
`server/src/env.ts`). The superuser bypasses all RLS policies, which means **every request
route will leak data across tenants** — each tenant can read every other tenant's users,
pipeline items, audit log, integrations, and all other data.

**Requirement:**
- Every production environment MUST have `APP_DATABASE_URL` set to a connection string that
  authenticates as the `il_app` Postgres role (or a role with equivalent non-superuser grants).
- The `il_app` role must NOT have `BYPASSRLS` or `SUPERUSER` privileges.
- Do NOT deploy or promote to production with `APP_DATABASE_URL` missing or pointing to a
  superuser credential. This is a hard launch gate — violating it silently destroys the
  entire runtime tenant isolation subsystem (`tenant-iso-enforcement`).
- Verify on each fresh environment by checking `\du il_app` in psql and confirming no
  `Bypass RLS` attribute is listed.

---

## Why this also protects the shared product
Rules 1–4 aren't just for the dedicated future — they make **today's** single shared
deployment safer too: rolling deploys never half-break, rollbacks are trivial, and there's
no manual SQL to fat-finger. We pay these costs once, now, and they keep paying off as we
scale to many environments.

## One-line summary
**Identical image everywhere, config-only differences, forward-only expand/contract
migrations applied automatically, shared pool as canary, high-revenue customers updated
last.** Drift is the enemy; every rule kills drift.
