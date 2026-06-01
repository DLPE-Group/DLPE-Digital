# Phase 1c — Row-Level Security: approach (for review before implementing)

**Status:** Designed, NOT implemented. Needs an infra/security decision (below).
Deferred from the overnight autonomous run because it cannot be verified safely
without the decisions here, and a half-wired RLS is worse than none.
(See project memory `tenancy-rls-decision`.)

## Why it isn't a pure code change

The app connects as the Postgres **superuser** (`postgres`). Superusers — and
table owners — **bypass RLS**, and even `FORCE ROW LEVEL SECURITY` does not apply
to them. So enabling a policy on `Entity` would enforce *nothing* under the
current connection. Real enforcement needs all three:

1. **A non-superuser application role** (e.g. `il_app`) that owns no tables and
   has `SELECT/INSERT/UPDATE/DELETE` grants but not `BYPASSRLS`. The app connects
   as this role; migrations/seed continue as `postgres`.
2. **Per-request tenant context.** RLS policies read `current_setting('app.tenant')`.
   With Prisma + pooling, the robust pattern is to run each request's queries
   inside a transaction that first sets the GUC:
   ```ts
   await prisma.$transaction(async (tx) => {
     await tx.$executeRawUnsafe(`SET LOCAL app.tenant = $1`, tenantId);
     // ... all request queries on tx ...
   });
   ```
   This is invasive: every read/write path must run on the request-scoped `tx`.
   A Prisma client extension (`$extends` with a query hook) can centralize it, but
   needs careful testing against the existing 48-test suite.
3. **The policy + enablement migration (raw SQL):**
   ```sql
   ALTER TABLE "Entity" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "Entity" FORCE ROW LEVEL SECURITY;
   CREATE POLICY entity_tenant_isolation ON "Entity"
     USING ("tenantId" = current_setting('app.tenant', true));
   GRANT SELECT, INSERT, UPDATE, DELETE ON "Entity" TO il_app;
   ```

## Decision needed

- **App role:** OK to add a non-superuser `il_app` role to docker-compose + the
  dev/test/prod `DATABASE_URL`? (Migrations/seed keep using `postgres`.)
- **Request-scoping mechanism:** Prisma client extension (centralized, preferred)
  vs. explicit per-route transactions (more code, more obvious).
- **Test strategy:** a cross-tenant isolation test (seed a 2nd tenant group, set
  `app.tenant` to tenant A, assert tenant B's entities are invisible).

## Why deferring is safe

The product is single-tenant today (one GROUP), so RLS adds no *functional*
behavior now — only future multi-tenant safety. The `tenantId` column + the
tenant resolver (shipped in Phase 1a) are the expensive-to-retrofit parts and are
already in place. Turning on RLS is a localized follow-up once the role + scoping
mechanism are agreed.

## Phase 1d (partitioning) — same posture

Declarative partitioning of `Entity` by `entityTypeId` (and/or `tenantId`) is a
raw-SQL migration that recreates the table as partitioned and re-attaches data.
It is only worth doing at real volume and is independent of correctness. Defer
until a large-client load test justifies it; the query discipline (scalar-column
filters, scope-led indexes) that makes it effective is already in place from
Phase 1b.
