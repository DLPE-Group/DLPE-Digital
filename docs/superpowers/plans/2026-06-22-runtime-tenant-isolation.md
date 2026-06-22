# Runtime Tenant Isolation Enforcement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Activate the S0 Postgres RLS foundation on every tenant-scoped request route — route all request-path DB access through `withTenant(req.tenantId, …)` on the non-superuser `il_app` client so the database enforces isolation, with an isolation test per route family proving a second tenant cannot read or modify the first tenant's rows.

**Architecture:** Two DB roles — owner `prisma` (RLS-bypassing, used only by cross-tenant-by-design paths: migrations, seed, `/api/platform/*`, provisioning) and `appPrisma`/`il_app` (RLS-enforced, used by all request routes via `withTenant`). The fix per handler is mechanical: run its DB work inside `withTenant(req.tenantId!, db => …)` using `db` instead of `prisma`. RLS is the backstop.

**Tech Stack:** Express, Prisma 6, Postgres 16 RLS, Vitest.

## Global Constraints

- **The transformation pattern (apply verbatim to every tenant-scoped handler):**
  ```ts
  // BEFORE:  const rows = await prisma.user.findMany();
  // AFTER:
  const rows = await withTenant(req.tenantId!, (db) => db.user.findMany());
  // multi-query handler: wrap the whole action in one withTenant block and use `db` throughout:
  const result = await withTenant(req.tenantId!, async (db) => {
    const a = await db.role.update({ where: { id }, data });
    await db.fieldRule.deleteMany({ where: { roleId: id } });
    return a;
  });
  ```
  Import: `import { withTenant } from '../db/withTenant.js';` (path is `../db/withTenant.js` from `server/src/routes/*`).
- **Services** that use the module-level `prisma` gain an optional trailing param `db: Prisma.TransactionClient | PrismaClient = prisma` and use it for ALL their queries. Request handlers pass the `withTenant` `db`; non-request callers (provisioning, seed) call them unchanged (owner client). Follow the existing `cards.service.ts` precedent.
- **Do NOT touch** (cross-tenant by design, must stay on owner `prisma`): `routes/platform.ts`, everything under `server/src/domain/provisioning/**`, `prisma/seed.ts`, migrations. If a task is unsure whether a path is request-scoped, it is request-scoped only if it runs after `tenantContext` (i.e. under `app.use('/api', tenantContext)` and is not `/api/platform`).
- **RLS is the backstop — do NOT add manual `where: { tenantId }` filters** as the isolation mechanism; rely on the DB. Pre-existing `tenantId` filters may remain (harmless). Writes that already stamp `tenantId` keep doing so (WITH CHECK requires it).
- **`il_app` has full DML grants** on all tables (S0 `app_role` migration + default privileges); no new grants needed.
- Commit trailer ends: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Never run `prisma migrate dev`/`reset`. No schema migrations in this subsystem.
- Test DB prep: `node tests/prepare-db.mjs` (from repo root) before vitest. Run the full API suite **twice** at the end of each task for determinism.
- **Demo behaviour must not change:** existing tests run as the demo tenant (GUC=demo); RLS permits demo rows, so the full suite stays green. A converted route that suddenly returns zero rows for the demo means an RLS policy or grant gap — investigate, don't paper over.

---

### Task 1: il_app wiring + admin-gate tenant-portability + isolation harness + first conversion

**Files:**
- Modify: `tests/serve-test.mjs` (set `APP_DATABASE_URL` to the il_app URL so the running test server enforces RLS)
- Modify: `server/src/auth/preview.ts` (make `requireAdmin` tenant-portable)
- Create: `tests/iso-helper.mjs` (second-tenant fixture + token)
- Modify: `server/src/routes/users.ts`, `server/src/routes/roles.ts` (convert their GET list handlers as the first proof)
- Create: `tests/api/isolation.test.mjs` (the first isolation tests)

**Interfaces:**
- Produces: `ensureTenantB(prisma)`, `destroyTenantB(prisma)`, `TENANT_B_TOKEN`, and constants `TENANT_B_ID='tenant-iso-b'`, `TENANT_B_USER='u-iso-b'` from `tests/iso-helper.mjs`.

- [ ] **Step 1: Wire il_app into the test server**

In `tests/serve-test.mjs`, the `env` object passed to the spawned server currently sets `DATABASE_URL: TEST_DB_URL`. Add the il_app URL so `appPrisma` enforces RLS:
```js
const env = {
  ...process.env,
  DATABASE_URL: TEST_DB_URL,
  APP_DATABASE_URL: 'postgresql://il_app:il_app_pw@localhost:5432/intelligence_test',
  // (other existing vars unchanged)
};
```
(Match the il_app URL used in `tests/api/rls-isolation.test.mjs`.)

- [ ] **Step 2: Make `requireAdmin` tenant-portable**

In `server/src/auth/preview.ts`, the admin check uses `ADMIN_ROLE_IDS = new Set(['group-admin'])` and `ADMIN_ROLE_IDS.has(req.user.roleId)`. Provisioned tenants prefix role ids as `<slug>-group-admin`, so the literal-only check fails for every non-demo tenant. Replace the membership test in `isAdmin` and `requireAdmin` with a helper that also accepts the prefixed form:
```ts
export const ADMIN_ROLE_IDS = new Set(['group-admin']);

// A role grants admin if its id is the canonical 'group-admin' or a provisioned,
// slug-prefixed variant '<slug>-group-admin'. Tenant-portable (isolation still
// enforced by RLS + tenantContext — this only governs the admin *capability*).
export function roleIdIsAdmin(roleId: string | undefined): boolean {
  if (!roleId) return false;
  return ADMIN_ROLE_IDS.has(roleId) || roleId.endsWith('-group-admin');
}
```
Use `roleIdIsAdmin(req.user?.roleId)` in `isAdmin`, `requireAdmin`, and the `actingUserId` preview check. Behaviour for the demo (`group-admin`) is unchanged.

- [ ] **Step 3: Write the second-tenant fixture helper**

Create `tests/iso-helper.mjs`:
```js
// Second-tenant fixture for isolation tests. Uses the OWNER prisma (bypasses RLS)
// to seed/tear down tenant B directly; tenant-B *requests* go through the app (il_app+RLS).
import { token } from './helpers.mjs';

export const TENANT_B_ID = 'tenant-iso-b';
export const TENANT_B_USER = 'u-iso-b';
export const TENANT_B_ROLE = 'iso-b-group-admin'; // prefixed admin role → passes requireAdmin via roleIdIsAdmin
export const TENANT_B_TOKEN = () => token(TENANT_B_USER, 'admin@iso-b.test', TENANT_B_ROLE);

// Idempotent: create a minimal but valid tenant B (tenant + admin role + admin user).
export async function ensureTenantB(prisma) {
  await prisma.tenant.upsert({
    where: { id: TENANT_B_ID },
    create: { id: TENANT_B_ID, slug: 'iso-b', name: 'Isolation Tenant B', status: 'ACTIVE', region: 'eu' },
    update: {},
  });
  await prisma.role.upsert({
    where: { id: TENANT_B_ROLE },
    create: { id: TENANT_B_ROLE, name: 'Group Admin', system: true, tracks: [], edit: 'all', desc: 'admin', tenantId: TENANT_B_ID },
    update: {},
  });
  await prisma.user.upsert({
    where: { id: TENANT_B_USER },
    create: { id: TENANT_B_USER, name: 'Tenant B Admin', email: 'admin@iso-b.test', passwordHash: 'x',
      roleId: TENANT_B_ROLE, scopeType: 'group', status: 'active', platformAdmin: false, tenantId: TENANT_B_ID },
    update: {},
  });
}

// FK-safe teardown of tenant B and anything created under it.
export async function destroyTenantB(prisma) {
  const tid = TENANT_B_ID;
  for (const m of ['subscription','userScope','user','fieldRule','stageDef','stageConfig','fieldDef',
                   'entityType','trackDef','crossTrigger','report','dashboardLayout','auditEntry',
                   'integration','invoice','fleetOperator','vehicleTimeline','portalMessage',
                   'dataSharing','rbacVersion','entity','role','orgNode','provisioningRun']) {
    if (prisma[m]?.deleteMany) { try { await prisma[m].deleteMany({ where: { tenantId: tid } }); } catch {} }
  }
  try { await prisma.tenant.delete({ where: { id: tid } }); } catch {}
}
```
(Note: `token()` from `helpers.mjs` signs `{sub,email,roleId}`; the server re-derives `tenantId` from the seeded user row, so tenant B's `req.tenantId` will be `tenant-iso-b`.)

- [ ] **Step 4: Convert the first two handlers**

In `server/src/routes/users.ts`, convert `GET /` (the `prisma.user.findMany(...)` list) to `withTenant(req.tenantId!, (db) => db.user.findMany(...))`. In `server/src/routes/roles.ts`, convert `GET /` similarly. (Other handlers in these files are converted in Task 2 — converting only the list here keeps Task 1 about the harness.)

- [ ] **Step 5: Write the first isolation tests**

Create `tests/api/isolation.test.mjs`:
```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, token, TEST_DB_URL } from '../helpers.mjs';
import { ensureTenantB, destroyTenantB, TENANT_B_TOKEN } from '../iso-helper.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const A = () => token('u-robert', 'r.mertens@group.eu', 'group-admin'); // demo admin (tenant A)

beforeAll(async () => { await ensureTenantB(prisma); });
afterAll(async () => { await destroyTenantB(prisma); await prisma.$disconnect(); });

describe('isolation: users + roles list', () => {
  it('tenant A sees its own users; tenant B sees only its own', async () => {
    const a = await get('/admin/users', A());
    expect(a.status).toBe(200);
    expect(a.body.length).toBeGreaterThan(1); // demo has 9
    const b = await get('/admin/users', TENANT_B_TOKEN());
    expect(b.status).toBe(200);
    // tenant B sees ONLY its own user(s) — never the demo's users
    expect(b.body.every((u) => u.tenantId === 'tenant-iso-b')).toBe(true);
    expect(b.body.some((u) => u.email === 'r.mertens@group.eu')).toBe(false);
  });
  it('tenant B sees only its own roles', async () => {
    const b = await get('/admin/roles', TENANT_B_TOKEN());
    expect(b.status).toBe(200);
    expect(b.body.every((r) => r.tenantId === 'tenant-iso-b')).toBe(true);
    expect(b.body.some((r) => r.id === 'group-admin')).toBe(false);
  });
});
```

- [ ] **Step 6: Run isolation tests + full suite twice**

Run: `node tests/prepare-db.mjs && npx vitest run tests/api/isolation.test.mjs`
Expected: PASS (proves RLS now enforced on the converted routes through the app).
Then: `node tests/prepare-db.mjs && npx vitest run tests/api && npx vitest run tests/api`
Expected: 123+ tests green both runs (demo behaviour unchanged; the new isolation file adds tests).

- [ ] **Step 7: Commit**
```bash
git add tests/serve-test.mjs server/src/auth/preview.ts tests/iso-helper.mjs server/src/routes/users.ts server/src/routes/roles.ts tests/api/isolation.test.mjs
git commit -m "tenant-iso Task 1: il_app test wiring, tenant-portable requireAdmin, isolation harness + users/roles list

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: RBAC family (users, roles, field-rules, rbac versions)

**Files:** `server/src/routes/users.ts`, `server/src/routes/roles.ts`, `server/src/routes/fieldRules.ts` (+ any rbac-version handlers, likely in `fieldRules.ts` or a dedicated file), and any service they call.
**Test:** add to `tests/api/isolation.test.mjs`.

- [ ] **Step 1:** Convert EVERY remaining tenant-scoped handler in these files to the `withTenant` pattern (Global Constraints). Handlers to cover: users — `GET /:id`, `PATCH /:id`, `POST /` (already stamps tenantId; wrap its reads/writes), `POST /:id/scopes`, `DELETE /:id/scopes/:scopeId`, `POST /import`; roles — `PATCH /:id`, `DELETE /:id`, `POST /:id/clone`; field-rules — `GET /`, `PUT /`; rbac versions — `GET /rbac/versions`, `POST /rbac/versions/:v/revert`. Thread `db` into any service used.
- [ ] **Step 2:** Add isolation tests: as tenant B, `PATCH /admin/users/:id` and `DELETE /admin/roles/:id` targeting a **tenant A id** must NOT modify A's row (RLS → zero rows updated/deleted; expect 404 or a no-op verified by re-reading A's row as tenant A and asserting it's unchanged). `GET /admin/field-rules` and `GET /admin/rbac/versions` as tenant B return only B's rows (or empty).
- [ ] **Step 3:** `node tests/prepare-db.mjs && npx vitest run tests/api/isolation.test.mjs` → pass; then full suite twice → green.
- [ ] **Step 4:** Commit (`tenant-iso Task 2: RBAC family through withTenant`).

---

### Task 3: Config family (data-model, structure + data-sharing, stage-config)

**Files:** `server/src/routes/dataModel.ts`, `server/src/routes/structure.ts`, `server/src/domain/structure.service.ts`, `server/src/routes/stageConfig.ts`.
**Test:** add to `tests/api/isolation.test.mjs`.

- [ ] **Step 1:** Convert all tenant-scoped handlers: data-model — `GET /data-model`, `POST/PATCH/DELETE tracks`, `POST/PATCH/DELETE types`, `POST/PATCH/DELETE fields`; structure — `GET /structure`, `POST companies`, `POST nodes`, `PATCH /:id`, `DELETE /:id`, `GET/PUT /data-sharing`; stage-config — `GET /stage-config` and any writes. Thread `db` into `structure.service.ts` (add the optional `db` param).
- [ ] **Step 2:** Isolation tests: `GET /admin/data-model` and `GET /admin/structure` as tenant B return only B's tracks/types/nodes; `DELETE /admin/data-model/tracks/:key` and `PATCH /admin/structure/:id` targeting A's key/id do not affect A (verify A unchanged).
- [ ] **Step 3:** isolation test + full suite twice → green.
- [ ] **Step 4:** Commit (`tenant-iso Task 3: config family through withTenant`).

---

### Task 4: Integrations + triggers family

**Files:** `server/src/routes/integrations.ts`, `server/src/routes/triggers.ts`.
**Test:** add to `tests/api/isolation.test.mjs`.

- [ ] **Step 1:** Convert: integrations — `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`, `POST /:id/test`, `GET /:id/logs`; triggers — `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id`. (Integrations may load audit via a service — thread `db` there too if so.)
- [ ] **Step 2:** Isolation tests: `GET /integrations` and `GET /admin/triggers` as tenant B return only B's rows; `DELETE /integrations/:id` / `PATCH /admin/triggers/:id` on A's id are no-ops against A.
- [ ] **Step 3:** isolation test + full suite twice → green.
- [ ] **Step 4:** Commit (`tenant-iso Task 4: integrations + triggers through withTenant`).

---

### Task 5: Reporting + me family (reports, audit, dashboard, permissions, preferences)

**Files:** `server/src/routes/reports.ts`, `server/src/routes/audit.ts`, `server/src/domain/audit.service.ts`, `server/src/routes/dashboard.ts`, `server/src/routes/permissions.ts`, `server/src/routes/preferences.ts`.
**Test:** add to `tests/api/isolation.test.mjs`.

- [ ] **Step 1:** Convert: reports — `GET /`, `GET /:id`, `POST /`, `DELETE /:id`; audit — `GET /`, `POST /:id/revert` (thread `db` into `audit.service.ts` — note `writeAudit`'s `tenantId` default is `DEMO_TENANT_ID`; request callers must pass `req.tenantId` and the `db` client); dashboard — `GET /`, `PUT /`; permissions — `GET /me/permissions` (scope the fieldRule/role reads via `withTenant`); preferences — `GET /`, `PUT /`. Keep `actingUserId`/preview behaviour intact.
- [ ] **Step 2:** Isolation tests: `GET /reports` and `GET /audit` as tenant B return only B's rows; `DELETE /reports/:id` on A's id is a no-op against A; `GET /me/permissions` as tenant B resolves against B's roles only.
- [ ] **Step 3:** isolation test + full suite twice → green.
- [ ] **Step 4:** Commit (`tenant-iso Task 5: reporting + me family through withTenant`).

---

### Task 6: Domain/entity family (fleet/portal, remaining cards, records)

**Files:** `server/src/routes/fleet.ts`, `server/src/routes/cards.ts`, `server/src/domain/cards.service.ts`, `server/src/routes/records.ts`, and `search.ts`/`aggregations.ts`/`notifications.ts` IF they read tenant data.
**Test:** add to `tests/api/isolation.test.mjs`.

- [ ] **Step 1:** Convert: fleet — `GET /vehicles`, `GET /vehicles/timeline`, `GET /portal`, `GET /portal/messages`, `POST /portal/messages`; cards — `GET /cards/:id`, `PATCH /cards/:id` (and confirm `POST/DELETE/PUT stage` already pass `tenantId` into a service that uses `withTenant` or the tenant `db`; if they use owner `prisma`, convert); records — any DB-backed handlers (skip if it only returns static SAMPLE_RECORDS); search/aggregations/notifications — convert any tenant-data reads, else leave (note in report which were static/no-DB).
- [ ] **Step 2:** Isolation tests: `GET /vehicles` and `GET /portal/messages` as tenant B return only B's rows (B has none → empty, and never A's vehicles/messages); `GET /cards/:id` / `PATCH /cards/:id` on an A card id as tenant B → 404 / no-op.
- [ ] **Step 3:** isolation test + full suite twice → green.
- [ ] **Step 4:** Commit (`tenant-iso Task 6: domain/entity family through withTenant`).

---

### Task 7: Sweep + deployment doc + final cross-route isolation proof

**Files:** any stragglers found; `docs/DEPLOYMENT-RULES.md`; `tests/api/isolation.test.mjs`.

- [ ] **Step 1:** Sweep for leaks: `grep -rn "prisma\." server/src/routes server/src/domain | grep -v provisioning | grep -v platform.ts` and review each remaining request-path `prisma.` usage. Every tenant-scoped read/write must be via `withTenant`/`db`; owner `prisma` is allowed ONLY in platform/provisioning/seed. Convert any straggler; list in the report what remains owner-by-design and why.
- [ ] **Step 2:** Update `docs/DEPLOYMENT-RULES.md`: add a rule that production MUST set `APP_DATABASE_URL` to the non-superuser `il_app` connection string — if it falls back to the owner URL, RLS is bypassed and tenant isolation is lost. Reference this subsystem.
- [ ] **Step 3:** Final cross-route isolation sweep test: as tenant B, hit one read route per family (`/admin/users`, `/admin/data-model`, `/integrations`, `/reports`, `/vehicles`) and assert none return any tenant-A row. Confirm tenant B cannot mutate any A row across families.
- [ ] **Step 4:** `node tests/prepare-db.mjs && npx vitest run tests/api && npx vitest run tests/api` → green twice; `cd app && npm run build` → succeeds.
- [ ] **Step 5:** Commit (`tenant-iso Task 7: leak sweep + APP_DATABASE_URL deploy rule + final isolation proof`).
