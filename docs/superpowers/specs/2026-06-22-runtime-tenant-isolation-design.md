# S-ISO — Runtime Tenant Isolation Enforcement — design

> **Status:** design for the runtime tenant-isolation subsystem. Approved 2026-06-22 after an audit found the launch-blocking gap: Postgres RLS (built in S0) is **passive** — only `GET /cards` runs through `withTenant`, so every other request route uses the RLS-bypassing owner client and most reads/updates/deletes carry no `tenantId` filter. A second real tenant would read and modify every tenant's data. This subsystem **activates** the S0 RLS foundation across all request routes. It is the gate before customer #2. SSO/identity (S5) and per-tenant email uniqueness are explicitly out of scope.

## Goal

Make tenant isolation **enforced by the database**, not by hand-written filters: every request-path query runs as the non-superuser `il_app` role inside a `withTenant(req.tenantId, …)` transaction that sets the `app.tenant` GUC, so RLS scopes reads/writes to the caller's tenant. A handler that *forgets* a filter leaks nothing — the database refuses to return or mutate other tenants' rows. Each route family ships with a test proving a second tenant's user cannot read or modify the first tenant's rows.

## The two database roles (the core principle)

- **Owner client (`prisma`, superuser via `DATABASE_URL`)** — bypasses RLS. Used ONLY by paths that are **legitimately cross-tenant**: migrations, seed, the platform/control-plane routes (`/api/platform/*` — list all tenants, provision, billing), and the provisioning engine. These stay on `prisma`. Unchanged.
- **App client (`appPrisma`, `il_app` non-superuser via `APP_DATABASE_URL`)** — RLS-enforced. Used by ALL tenant-scoped **request routes** via `withTenant(req.tenantId, db => …)`. This subsystem moves every leaking request route onto this client.

`il_app` already has full DML grants on all tables (S0 `app_role` migration + `ALTER DEFAULT PRIVILEGES`; later migrations grant explicitly) and no BYPASSRLS — so the approach needs no new grants.

## Mechanism (decision)

**Explicit per-handler `withTenant` wrap**, mirroring the existing `cards.ts` pattern — not a Prisma client-extension or AsyncLocalStorage magic. Each tenant-scoped handler becomes:
```ts
const data = await withTenant(req.tenantId!, async (db) => {
  // all of this handler's DB work, using `db` (the tx client), not `prisma`
  return db.user.findMany({ ... });
});
res.json(data);
```
Services that currently use the module-level `prisma` gain an optional trailing parameter `db: Prisma.TransactionClient | PrismaClient = prisma`, and use that for every query. Request handlers pass the `withTenant` `db`; non-request callers (provisioning, seed) call them unchanged and keep the owner client. This:
- preserves atomicity within a handler (one transaction per request action),
- is transparent and reviewable (no hidden query interception),
- makes RLS the backstop — we deliberately **do not** also add manual `where: { tenantId }` filters; the database enforces it. (Existing explicit `tenantId` filters may stay but are now belt-and-suspenders.)

Rationale for rejecting alternatives: a `$extends` client that wraps every operation in its own `set_config` transaction loses intra-handler atomicity and hides behaviour; a request-long transaction holds a pooled connection for the whole request (deadlock/exhaustion risk). YAGNI.

## Test enforcement (decision)

The running test server (`tests/serve-test.mjs`) currently sets only `DATABASE_URL`, so `appPrisma` falls back to the owner connection and RLS is **not actually exercised through the app**. This subsystem sets `APP_DATABASE_URL` to the `il_app` URL in `serve-test.mjs`, so converted routes truly enforce RLS in the API tests. The existing suite runs as the demo tenant (GUC = demo) and RLS permits the demo's own rows, so existing tests keep passing. Routes not yet converted keep using the owner client and keep working — enabling safe, incremental family-by-family conversion.

A shared isolation-test helper seeds a **second tenant** ("tenant B") with its own admin user + a JWT, and asserts that tenant B's requests to each converted route return/modify only tenant B's rows (and cannot touch tenant A's by id/key). The demo (tenant A) state is restored in `afterAll`.

## Scope — by route family (each = a plan task, each independently testable)

1. **Test harness + il_app wiring** — set `APP_DATABASE_URL=il_app` in `serve-test.mjs`; add the second-tenant isolation-test helper; convert `GET /users` (and `GET /roles`) as the first proof + write the first isolation test; confirm the full existing suite stays green under `il_app`.
2. **RBAC family** — users (list/get/update/scopes/import), roles (list/update/delete/clone), field-rules (get/put), rbac versions (list/revert) → `withTenant`; isolation tests.
3. **Config family** — data-model (tracks/types/fields CRUD), structure/orgNodes (+ data-sharing), stage-config → `withTenant`; isolation tests.
4. **Integrations + triggers family** — integrations (list/create/update/delete/test/logs), triggers (list/create/update/delete) → `withTenant`; isolation tests.
5. **Reporting + me family** — reports (list/get/create/delete), audit (list/revert), dashboard, permissions, preferences → `withTenant`; isolation tests.
6. **Domain/entity family** — fleet/vehicles/portal (vehicles, timeline, operators, invoices, messages), the remaining `cards` handlers not yet scoped (`GET /cards/:id`, `PATCH /cards/:id`), records, search/aggregations/notifications if they read tenant data → `withTenant`; isolation tests.
7. **Sweep + deploy doc** — grep for any remaining `prisma.` usage in request routers/services that isn't owner-by-design; convert stragglers; update `docs/DEPLOYMENT-RULES.md` / the hosting plan to require `APP_DATABASE_URL=il_app` in production; run a final cross-route isolation sweep (tenant B touches nothing of tenant A) + the full suite twice.

## Out of scope
- **Platform/provisioning/seed/migrations** — cross-tenant by design; stay on the owner client (verify they are NOT accidentally moved to `withTenant`).
- **Per-tenant email uniqueness** (`@@unique([tenantId, email])`) and tenant resolution at login (S5) — tracked separately; this subsystem does not change login or the User uniqueness constraint.
- Connection-pool tuning for `il_app`, read replicas, query-performance work.

## Error handling
- `withTenant` requires `req.tenantId` (set by `tenantContext` after auth); handlers use `req.tenantId!`. A request without tenant context is already 401'd by `tenantContext`.
- RLS denials surface as empty result sets (reads) or zero-row updates/deletes. Handlers that 404 on "not found" naturally 404 when RLS hides another tenant's row — which is the correct cross-tenant response (don't reveal existence). Tests assert this.
- A converted handler that needs a write the policy forbids (WITH CHECK violation) throws → 500; tests ensure handlers only write their own tenant's rows so this can't happen in normal use.

## Testing
- Per family: a `*-isolation.test.mjs` (or additions to the family's existing test) using the tenant-B helper — for each route, tenant B sees only its rows on reads, and cannot read/update/delete tenant A's rows by id/key (404 / empty / no-op, never tenant A's data).
- The existing full API suite (123 tests) must stay green after each family (run twice for determinism), proving demo-tenant behaviour is unchanged under RLS.
- The existing `tests/api/rls-isolation.test.mjs` (DB-level proof) stays as the foundation.
- Final sweep test: a second tenant exercising one route per family confirms zero cross-tenant access.

## Rollout note (ties to DEPLOYMENT-RULES.md)
Production MUST set `APP_DATABASE_URL` to the `il_app` connection string (non-superuser) for isolation to hold; if it falls back to the owner URL, RLS is bypassed. This subsystem makes that a documented, required deploy secret.
