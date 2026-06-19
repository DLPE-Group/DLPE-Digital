# S2 — Blueprints / Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Capture any live tenant's setup as a reusable blueprint, manage its lifecycle (draft/publish/archive), and export/import — all from the control plane.

**Architecture:** Two new routes on the existing `platformRouter` (capture-from-tenant wrapping S1's `captureBlueprint`; status PATCH) + a Blueprints management section in the control-plane UI. No schema changes (`Blueprint` already has status/sourceTenantId/spec).

**Tech Stack:** Express + Prisma 6, Vite/React, Vitest API + Playwright.

## Global Constraints
- Builds on S0+S1+S3+S6 (all merged to main). Branch: `feature/s2-blueprints` (off main).
- New routes go on the existing `platformRouter` (`server/src/routes/platform.ts`), behind `requirePlatformAdmin`, using the owner `prisma`. Reuse `BlueprintSpec` (from `@dlpe/shared`) for validation and `captureBlueprint(prisma, tenantId)` (from `server/src/domain/provisioning/captureBlueprint.ts`).
- `BlueprintStatus` enum = `DRAFT | PUBLISHED | ARCHIVED`. Capture creates `DRAFT` with `sourceTenantId`.
- **Capture is config-only** (captureBlueprint already omits business rows) — never leaks one tenant's data into a template.
- **Test isolation (S3/S6 lesson):** every test that captures a blueprint or provisions a tenant MUST delete what it created (FK-safe order); use unique keys; restore the demo if touched. Final verify runs the API suite twice (determinism).
- Migrations: none expected. Commit trailer ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure
- `server/src/routes/platform.ts` — add `POST /tenants/:id/capture` and `PATCH /blueprints/:id`.
- `app/src/admin_platform.jsx` — Blueprints management section (capture / publish / archive / export / import).
- Tests: `tests/api/blueprints-mgmt.test.mjs`, extend `tests/ui/control-plane.spec.mjs`.

---

### Task 1: Backend — capture-from-tenant + blueprint lifecycle

**Files:** Modify `server/src/routes/platform.ts`; Test `tests/api/blueprints-mgmt.test.mjs`.

**Interfaces:**
- Consumes: `captureBlueprint(prisma, tenantId)`, `BlueprintSpec`, `prisma`.
- Produces (on `platformRouter`, platform-admin-gated):
  - `POST /tenants/:id/capture { key, name }` → captures the tenant's config, validates with `BlueprintSpec`, creates a `Blueprint { key, name, status: 'DRAFT', spec, sourceTenantId: <id> }`. 400 missing key/name; 404 unknown tenant; 409 duplicate key; 422 invalid captured spec. Returns the created blueprint.
  - `PATCH /blueprints/:id { status }` → validate status ∈ BlueprintStatus enum (400 else); update; 404 unknown. Returns the updated blueprint.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/blueprints-mgmt.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, patch, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

afterAll(async () => {
  await prisma.blueprint.deleteMany({ where: { key: { startsWith: 'cap-' } } });
  await prisma.$disconnect();
});

describe('blueprint management', () => {
  it('captures the demo tenant into a DRAFT blueprint', async () => {
    const r = await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-demo', name: 'Captured demo' }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('DRAFT');
    expect(r.body.sourceTenantId).toBe('tenant-dlpe-demo');
    // the captured spec is a valid BlueprintSpec (roles/tracks present)
    expect(Array.isArray(r.body.spec.roles)).toBe(true);
    expect(r.body.spec.roles.length).toBeGreaterThan(0);
  });
  it('publishes then archives a blueprint', async () => {
    const id = (await get('/platform/blueprints', PLATFORM())).body.find((b) => b.key === 'cap-demo').id;
    expect((await patch(`/platform/blueprints/${id}`, { status: 'PUBLISHED' }, PLATFORM())).body.status).toBe('PUBLISHED');
    expect((await patch(`/platform/blueprints/${id}`, { status: 'ARCHIVED' }, PLATFORM())).body.status).toBe('ARCHIVED');
    expect((await patch(`/platform/blueprints/${id}`, { status: 'NOPE' }, PLATFORM())).status).toBe(400);
  });
  it('rejects duplicate capture key (409) and gates non-admins (403)', async () => {
    expect((await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-demo', name: 'dup' }, PLATFORM())).status).toBe(409);
    expect((await req('POST', '/platform/tenants/tenant-dlpe-demo/capture', { body: { key: 'cap-x', name: 'x' }, tok: NON() })).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/prepare-db.mjs && npm run test:api -- blueprints-mgmt`
Expected: FAIL — capture/patch routes 404.

- [ ] **Step 3: Implement the routes in `platform.ts`**

```ts
import { captureBlueprint } from '../domain/provisioning/captureBlueprint.js';

// POST /tenants/:id/capture { key, name }
const captureSchema = z.object({ key: z.string().min(1), name: z.string().min(1) });
platformRouter.post('/tenants/:id/capture', async (req, res) => {
  const parsed = captureSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'key and name are required' });
  const tenant = await prisma.tenant.findUnique({ where: { id: req.params.id } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  let spec;
  try { spec = await captureBlueprint(prisma, req.params.id); }
  catch (e) { return res.status(422).json({ error: 'Capture failed: ' + (e as Error).message }); }
  try {
    const bp = await prisma.blueprint.create({
      data: { key: parsed.data.key, name: parsed.data.name, status: 'DRAFT', spec, sourceTenantId: req.params.id },
    });
    return res.json(bp);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return res.status(409).json({ error: 'Blueprint key already exists' });
    throw e;
  }
});

// PATCH /blueprints/:id { status }
const bpStatusSchema = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) });
platformRouter.patch('/blueprints/:id', async (req, res) => {
  const parsed = bpStatusSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
  try {
    const bp = await prisma.blueprint.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
    return res.json(bp);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return res.status(404).json({ error: 'Blueprint not found' });
    throw e;
  }
});
```

`spec` from `captureBlueprint` is a typed `BlueprintSpec`; storing it as `Json` is fine (cast if tsc requires: `spec as unknown as Prisma.InputJsonValue`). `Prisma` is already imported in this file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/prepare-db.mjs && npm run test:api -- blueprints-mgmt` + `cd server && npx tsc --noEmit`
Expected: PASS + zero TS errors.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm run test:api`
Expected: all green (was 112 + the new file).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/platform.ts tests/api/blueprints-mgmt.test.mjs
git commit -m "feat(blueprints): capture-from-tenant + blueprint lifecycle (publish/archive)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Round-trip test — provision from a captured blueprint

**Files:** Test `tests/api/blueprints-mgmt.test.mjs`.

**Interfaces:**
- Consumes: the capture route (Task 1), `POST /platform/tenants` (S1 provision).
- Produces: a test proving a captured blueprint can provision a working tenant (capture is faithful enough to re-provision).

- [ ] **Step 1: Write the failing/【behavioral】 test**

```js
// add to tests/api/blueprints-mgmt.test.mjs
it('a captured blueprint can provision a new tenant (round-trip)', async () => {
  // capture (idempotent-ish: unique key)
  const cap = await post('/platform/tenants/tenant-dlpe-demo/capture', { key: 'cap-rt', name: 'RT' }, PLATFORM());
  expect(cap.status).toBe(200);
  // provision a new tenant from it (prefixed id mode — default — avoids literal-id clashes with the demo)
  const prov = await post('/platform/tenants', { blueprintKey: 'cap-rt', inputs: { slug: 'rt-clone', customerName: 'RT Clone' }, idempotencyKey: 'cap-rt-1' }, PLATFORM());
  expect(prov.status).toBe(200);
  const tid = prov.body.tenantId;
  expect(tid).toBeTruthy();
  // the clone has org + roles (prefixed ids) under its own tenantId
  expect(await prisma.role.count({ where: { tenantId: tid } })).toBeGreaterThan(0);
  expect(await prisma.orgNode.count({ where: { tenantId: tid } })).toBeGreaterThan(0);
  // cleanup the provisioned clone (FK-safe) + its subscription
  await prisma.subscription.deleteMany({ where: { tenantId: tid } });
  await prisma.user.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldRule.deleteMany({ where: { tenantId: tid } });
  await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
  await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldDef.deleteMany({ where: { tenantId: tid } });
  await prisma.entityType.deleteMany({ where: { tenantId: tid } });
  await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
  await prisma.crossTrigger.deleteMany({ where: { tenantId: tid } });
  await prisma.userScope.deleteMany({ where: { tenantId: tid } });
  await prisma.role.deleteMany({ where: { tenantId: tid } });
  await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
  await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
  await prisma.tenant.delete({ where: { id: tid } });
});
```

> **Implementer note:** confirm the exact set of tenant-scoped tables to clean by checking what `provisionTenant` writes (mirror the cleanup used in `provision-tenant.test.mjs`). If `captureBlueprint` omits some section (e.g. entityTypes) and the clone has none, the corresponding `deleteMany` is simply a no-op — safe. The captured `cap-rt` blueprint is removed by the `afterAll` (`startsWith: 'cap-'`).

- [ ] **Step 2: Run it**

Run: `node tests/prepare-db.mjs && npm run test:api -- blueprints-mgmt`
Expected: PASS (capture → provision → clone has rows → cleaned up). If provisioning from the captured spec fails, investigate whether `captureBlueprint` produces a provision-valid spec and fix the gap (this is the real value of the round-trip test).

- [ ] **Step 3: Full suite + determinism**

Run: `npm run test:api` then `npm run test:api` again (no reseed) → both green; demo untouched.

- [ ] **Step 4: Commit**

```bash
git add tests/api/blueprints-mgmt.test.mjs
git commit -m "test(blueprints): capture->provision round-trip

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Control-plane Blueprints management UI

**Files:** Modify `app/src/admin_platform.jsx`; Verify `npm --workspace app run build`.

**Interfaces:**
- Consumes: `GET /platform/blueprints`, `POST /platform/tenants/:id/capture`, `PATCH /platform/blueprints/:id`, `GET /platform/blueprints/:id/export`, `POST /platform/blueprints/import`, `GET /platform/tenants` (for the capture tenant picker).
- Produces: a Blueprints management section in `ControlPlaneView`.

- [ ] **Step 1: Build the Blueprints management section**

Replace/extend the existing read-only blueprints list in `admin_platform.jsx` with a management block (reuse the file's existing style objects + `setErr`/`reload`):
- **List** each blueprint: name · key · v{version} · status, plus per-row actions:
  - **Publish** (if DRAFT) / **Archive** (if not ARCHIVED) → `PATCH /platform/blueprints/:id { status }` then `reload()`.
  - **Export** → `GET /platform/blueprints/:id/export`, then trigger a client-side download of the JSON (`new Blob([JSON.stringify(spec, null, 2)], {type:'application/json'})` + an `<a download>` click).
- **Capture** control: a tenant `<select>` (from `tenants`) + key + name inputs + a "Capture" button → `POST /platform/tenants/:id/capture { key, name }` then `reload()`. Surface 409/422 errors inline.
- **Import** control: a `<textarea>` for pasted JSON + key + name → parse JSON client-side (try/catch → inline error), `POST /platform/blueprints/import { key, name, spec }` then `reload()`.

Keep it consistent with the existing tenants/provision sections (same card/table/button styles).

- [ ] **Step 2: Verify the build**

Run: `npm --workspace app run build`
Expected: succeeds (no JSX/import errors).

- [ ] **Step 3: Commit**

```bash
git add app/src/admin_platform.jsx
git commit -m "feat(blueprints): control-plane blueprint management (capture/publish/archive/export/import)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Playwright journey + final verification

**Files:** Modify `tests/ui/control-plane.spec.mjs`.

- [ ] **Step 1: Extend the journey**

Add a test (reuse `login`/`navTo`): log in as the platform admin, go to Control plane, capture a blueprint from the demo tenant (unique key, e.g. `cap-ui-<something stable>` — but avoid collisions across runs: use a fixed key and have the test delete it first via the API, OR assert idempotently). Simplest robust approach: capture with a fixed key `cap-ui`, then assert it appears in the blueprint list; then clean it up via the UI is hard, so instead add an `afterAll` that deletes `cap-ui` via a direct DB call (import PrismaClient + TEST_DB_URL like the API tests) so reruns are deterministic. Keep the suspend/reactivate + plan assertions intact.

- [ ] **Step 2: Run the journey**

Run: `npm run test:ui -- control-plane`
Expected: PASS. (If Playwright can't run in this environment, report the exact error but still complete the API + build verification.)

- [ ] **Step 3: Final verification**

Run: `node tests/prepare-db.mjs && npm run test:api` (full suite green) then again without reseed (determinism), and `npm --workspace app run build` (succeeds).

- [ ] **Step 4: Commit**

```bash
git add tests/ui/control-plane.spec.mjs
git commit -m "test(blueprints): control-plane capture journey + final verify

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review
**Spec coverage:** capture-from-tenant (T1) ✅; lifecycle publish/archive (T1) ✅; round-trip capture→provision (T2) ✅; export/import surfaced + capture/publish/archive UI (T3) ✅; journey (T4) ✅. Export/import endpoints reused from S1. No schema change (Blueprint already has status/sourceTenantId).
**Placeholder scan:** no TBD; the round-trip cleanup list is explicit with an implementer note to mirror `provision-tenant.test.mjs`.
**Type/isolation consistency:** capture stores `captureBlueprint` output (a `BlueprintSpec`) into `Blueprint.spec` (Json) — cast noted. `BlueprintStatus` enum values consistent across route/test. Test-isolation: `afterAll` deletes `cap-*` blueprints; round-trip + journey clean their provisioned tenants; final verify runs twice. Demo never left mutated (capture is read-only on the source tenant; provision creates a NEW tenant).

## Notes for the implementer
- `captureBlueprint` is read-only on the source tenant — capturing the demo does NOT change it. Provisioning from a captured blueprint uses default (prefixed) id mode, so the clone's ids don't collide with the demo's literal ids.
- Reuse existing platform export/import routes; don't duplicate them.
- Apply the S3/S6 test-isolation discipline rigorously (unique keys, full cleanup, twice-run determinism).
