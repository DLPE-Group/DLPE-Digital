# S1 — Provisioning Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a complete, isolated tenant from a declarative blueprint in one transactional, idempotent call — and dogfood it by turning the hardcoded `seed.ts` into the first `dlpe-demo` blueprint.

**Architecture:** A `Blueprint` row stores a Zod-validated declarative `spec` (org tree, roles, field-rules, tracks/stages/config, cross-triggers, entity-types/field-defs, optional seed entities, admin user). `provisionTenant({ blueprint, inputs, target })` validates inputs, asks a `ProvisioningTarget` to `prepare()` the tenant (shared-DB: create the `Tenant` row), then in ONE transaction interprets the spec into rows — all stamped with the new `tenantId`. A `ProvisioningRun` row makes it idempotent. `captureBlueprint(tenantId)` is the reverse: read a live tenant's config into a new blueprint (clone-from-previous). A platform-admin tier (above tenant RBAC) exposes a minimal `/api/platform/*` API. Builds on S0 (Tenant table, `tenantId` everywhere, RLS) — provisioning runs as the table-owner (`prisma`), which bypasses RLS.

**Tech Stack:** Express + Prisma 6 + Postgres 16, Zod (already a dependency), Vitest API suite (port 4100), argon2 (admin password hashing — already used).

## Global Constraints

- **Builds on S0 (branch `feature/s1-provisioning-engine`, off the S0 branch).** `Tenant`, non-null `tenantId` on 26 scoped models, and RLS already exist. Provisioning + capture run as the **owner** `prisma` client (bypasses RLS), NOT through `withTenant`/`il_app`.
- **Engine architecture = declarative blueprint + interpreter** (spec-approved Approach A). No imperative-code blueprints.
- **Blueprint `spec` is Zod-validated and carries `specVersion`** (integer, start at `1`) for forward-compat.
- **`provisionTenant` is atomic + idempotent.** All row creation runs in one `prisma.$transaction`; partial failure rolls back (including the `Tenant` row). An `idempotencyKey` + `ProvisioningRun` makes re-runs safe (no duplicate tenants/rows). Slug collisions are surfaced as structured errors, not crashes.
- **`ProvisioningTarget` seam:** `SharedDbTarget` fully implemented; `DedicatedDeploymentTarget` declared but throws `Error('Dedicated deployment is deferred to a future spec')`.
- **Platform-admin tier is ABOVE tenant RBAC.** The demo `group-admin` (`r.mertens`) is a *tenant* admin, distinct. Platform endpoints live under `/api/platform/*` and are gated by a new `requirePlatformAdmin` guard. Do NOT reuse `requireAdmin` (that's tenant-group-admin).
- **Dogfood:** refactor `server/prisma/seed.ts` into the first `PUBLISHED` blueprint `dlpe-demo`; `prisma db seed` becomes `provisionTenant(dlpeDemoBlueprint, demoInputs, new SharedDbTarget())`. The provisioned demo MUST reproduce today's data so the existing 77-test suite stays green. The demo tenant keeps id `tenant-dlpe-demo` / slug `dlpe-demo` (consumed by S0 tests + `DEMO_TENANT_ID`).
- **`CountryDefaults` stays global** — it is seeded once, NOT part of a tenant blueprint (no `tenantId`). The blueprint's org spec may *reference* country codes but does not own CountryDefaults rows.
- **Migrations:** hand-author + `prisma migrate deploy`; never `migrate dev`/`reset` in CI (`reset` blocked for AI agents). Test DB prepped via `node tests/prepare-db.mjs`.
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## File Structure

- `server/prisma/schema.prisma` — add `Blueprint` + `ProvisioningRun` models; add `platformAdmin Boolean @default(false)` to `User`.
- `server/prisma/migrations/<ts>_blueprint_provisioning/migration.sql` — the two tables + the `User.platformAdmin` column (additive, nullable/defaulted). Grant the new tables to `il_app` (consistency with S0; even though provisioning uses the owner).
- `packages/shared/blueprint.ts` — **new.** The Zod `BlueprintSpec` schema + inferred TS type + `SPEC_VERSION` constant. Exported from `@dlpe/shared`.
- `server/src/domain/provisioning/target.ts` — **new.** `ProvisioningTarget` interface, `SharedDbTarget`, `DedicatedDeploymentTarget` (throws).
- `server/src/domain/provisioning/provisionTenant.ts` — **new.** `provisionTenant(...)` interpreter + `ProvisioningResult` type.
- `server/src/domain/provisioning/captureBlueprint.ts` — **new.** `captureBlueprint(prisma, tenantId, meta)` → `BlueprintSpec`.
- `server/src/domain/provisioning/dlpeDemoBlueprint.ts` — **new.** The `dlpe-demo` `BlueprintSpec` literal (extracted from the current `seed.ts` data) + `demoInputs`.
- `server/src/auth/platform.ts` — **new.** `isPlatformAdmin(req)`, `requirePlatformAdmin` middleware.
- `server/src/routes/platform.ts` — **new.** `/api/platform/tenants` (POST/GET), `/api/platform/blueprints` (GET/POST + `/:id/export`, `/import`).
- `server/src/index.ts` — mount `platformRouter` under `/api/platform` behind `requirePlatformAdmin`.
- `server/prisma/seed.ts` — slimmed to call `provisionTenant(dlpeDemoBlueprint, demoInputs, new SharedDbTarget())` (+ the one global `CountryDefaults` seed).
- `server/src/auth/AuthProvider.ts` / `JwtAuthProvider.ts` — add `platformAdmin: boolean` to `AuthUser`.
- Tests: `tests/api/blueprint-schema.test.mjs`, `provision-tenant.test.mjs`, `provision-idempotency.test.mjs`, `capture-blueprint.test.mjs`, `platform-api.test.mjs`, `dogfood-seed.test.mjs`.

---

### Task 1: Blueprint + ProvisioningRun schema + platform-admin column

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<ts>_blueprint_provisioning/migration.sql`
- Test: `tests/api/blueprint-schema.test.mjs`

**Interfaces:**
- Produces: `prisma.blueprint` `{ id, key (unique), name, version Int, status (BlueprintStatus enum DRAFT|PUBLISHED|ARCHIVED), spec Json, sourceTenantId String?, description String?, createdById String?, createdAt }`; `prisma.provisioningRun` `{ id, idempotencyKey (unique), blueprintId, tenantId String?, slug String, status (ProvisioningStatus enum PENDING|SUCCEEDED|FAILED), steps Json?, error String?, createdAt, finishedAt? }`; `User.platformAdmin Boolean`.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/blueprint-schema.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('Blueprint + ProvisioningRun tables', () => {
  it('can create and read a Blueprint row', async () => {
    const bp = await prisma.blueprint.create({
      data: { key: 'tmp-bp', name: 'Tmp', version: 1, status: 'DRAFT', spec: { specVersion: 1 } },
    });
    expect(bp.id).toBeTruthy();
    await prisma.blueprint.delete({ where: { id: bp.id } });
  });
  it('User has a platformAdmin flag defaulting false', async () => {
    const u = await prisma.user.findUnique({ where: { id: 'u-robert' } });
    expect(u.platformAdmin).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/prepare-db.mjs && npm run test:api -- blueprint-schema`
Expected: FAIL — `prisma.blueprint` undefined / `platformAdmin` unknown.

- [ ] **Step 3: Add models + column to `schema.prisma`**

```prisma
enum BlueprintStatus { DRAFT PUBLISHED ARCHIVED }
enum ProvisioningStatus { PENDING SUCCEEDED FAILED }

model Blueprint {
  id            String          @id @default(cuid())
  key           String          @unique
  name          String
  version       Int             @default(1)
  status        BlueprintStatus @default(DRAFT)
  spec          Json
  sourceTenantId String?
  description   String?
  createdById   String?
  createdAt     DateTime        @default(now())
  runs          ProvisioningRun[]
}

model ProvisioningRun {
  id             String             @id @default(cuid())
  idempotencyKey String             @unique
  blueprintId    String
  blueprint      Blueprint          @relation(fields: [blueprintId], references: [id])
  tenantId       String?
  slug           String
  status         ProvisioningStatus @default(PENDING)
  steps          Json?
  error          String?
  createdAt      DateTime           @default(now())
  finishedAt     DateTime?
  @@index([blueprintId])
}
```

Add to `model User`: `platformAdmin Boolean @default(false)`. Blueprint/ProvisioningRun are **platform-level, not tenant-scoped** — they get NO `tenantId` and NO RLS (they live above tenants).

- [ ] **Step 4: Generate + author the migration**

Run `cd server && npx prisma migrate dev --name blueprint_provisioning --create-only`, inspect (only CREATE TABLE Blueprint/ProvisioningRun, CREATE TYPE enums, ADD COLUMN User.platformAdmin defaulted, indexes — all additive), then append a grant for the il_app role so it stays consistent with S0:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON "Blueprint", "ProvisioningRun" TO il_app;
```

Apply with `npx prisma migrate deploy`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `node tests/prepare-db.mjs && npm run test:api -- blueprint-schema`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/prisma tests/api/blueprint-schema.test.mjs
git commit -m "feat(provisioning): Blueprint + ProvisioningRun tables + User.platformAdmin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: BlueprintSpec Zod schema (shared)

**Files:**
- Create: `packages/shared/blueprint.ts`
- Modify: `packages/shared/index.ts` (re-export)
- Test: `tests/api/blueprint-schema.test.mjs` (add a validation case)

**Interfaces:**
- Consumes: nothing (pure schema).
- Produces: `SPEC_VERSION = 1`; `BlueprintSpec` Zod schema + `type BlueprintSpec = z.infer<...>`. Sections: `specVersion`, `inputs[]`, `orgStructure`, `roles[]`, `fieldRules[]`, `tracks[]`, `entityTypes[]`, `crossTriggers[]`, `seed?`, `branding?`, `integrations?`, `adminUser`. Consumed by Tasks 3–7.

- [ ] **Step 1: Write the failing test**

```js
// add to tests/api/blueprint-schema.test.mjs
import { BlueprintSpec, SPEC_VERSION } from '@dlpe/shared';

describe('BlueprintSpec schema', () => {
  it('accepts a minimal valid spec and rejects an invalid one', () => {
    const minimal = {
      specVersion: SPEC_VERSION,
      inputs: [],
      orgStructure: { id: 'grp', kind: 'group', name: 'G', children: [] },
      roles: [], fieldRules: [], tracks: [], entityTypes: [], crossTriggers: [],
      adminUser: { idPrefix: 'u', name: 'A', email: 'a@x.io', roleId: 'group-admin', scopeType: 'group' },
    };
    expect(BlueprintSpec.safeParse(minimal).success).toBe(true);
    expect(BlueprintSpec.safeParse({ specVersion: 1 }).success).toBe(false); // missing required sections
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:api -- blueprint-schema`
Expected: FAIL — `BlueprintSpec` not exported.

- [ ] **Step 3: Implement `packages/shared/blueprint.ts`**

Define the schema with Zod. Model each section on the existing seed shapes (see `server/prisma/seed.ts`):
- `orgNode` is recursive: `{ id, kind: enum('group','region','country','company'), name, code?, meta?, settings?, overrides?, children: orgNode[] }` (use `z.lazy`).
- `role`: `{ id, name, system, tracks: string[], edit, desc }`.
- `fieldRule`: `{ roleId, dataTypeId, fieldId, scope: default 'ANY', visible, editable, masked, note? }`.
- `track`: `{ key, label, color?, icon?, order, builtin, stages: stageDef[] }` where `stageDef = { stageId, label, sla, lock?, cta, order }`.
- `entityType`: `{ key, label, kind: enum('pipeline','reference'), trackKey?, icon?, color?, order, builtin, fields: fieldDef[] }`, `fieldDef = { key, label, category?, dataKind, order, builtin }`.
- `crossTrigger`: `{ whenTrack, whenStage, thenTrack, thenStage, note }`.
- `seed`: optional `{ entities?: any[], extras?: any }` (toggleable demo data — keep permissive `z.unknown()` arrays here; the demo blueprint carries its concrete seed payload and the interpreter knows how to write it).
- `branding`: optional `{ name?, primaryColor?, logo? }`.
- `integrations`: optional array of integration placeholders (disabled).
- `adminUser`: `{ idPrefix, name, email, roleId, scopeType, password? }`.
- `input`: `{ key, label, type: enum('string','email','locale','currency','region','number','boolean'), required: default true, default? }`.

Export `SPEC_VERSION = 1` and `BlueprintSpec` + `type BlueprintSpec`. Re-export both from `packages/shared/index.ts`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api -- blueprint-schema` then `cd server && npx tsc --noEmit`
Expected: PASS + zero TS errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared tests/api/blueprint-schema.test.mjs
git commit -m "feat(provisioning): BlueprintSpec Zod schema (specVersion 1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: ProvisioningTarget interface + SharedDbTarget

**Files:**
- Create: `server/src/domain/provisioning/target.ts`
- Test: `tests/api/provision-tenant.test.mjs` (target cases)

**Interfaces:**
- Consumes: `prisma` client, `BlueprintSpec`.
- Produces:
  - `interface TenantContext { tenantId: string; slug: string; }`
  - `interface ProvisioningTarget { prepare(args: { slug: string; name: string; region: string; tenantId?: string }, tx: Prisma.TransactionClient): Promise<TenantContext>; }`
  - `class SharedDbTarget implements ProvisioningTarget` — `prepare` creates a `Tenant` row (honoring an optional explicit `tenantId` for the demo) and returns `{ tenantId, slug }`.
  - `class DedicatedDeploymentTarget implements ProvisioningTarget` — `prepare` throws `Error('Dedicated deployment is deferred to a future spec')`.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/provision-tenant.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('ProvisioningTarget', () => {
  it('SharedDbTarget.prepare creates a Tenant; Dedicated throws', async () => {
    const { SharedDbTarget, DedicatedDeploymentTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const ctx = await prisma.$transaction((tx) =>
      new SharedDbTarget().prepare({ slug: 'tgt-test', name: 'Tgt', region: 'eu' }, tx));
    expect(ctx.tenantId).toBeTruthy();
    const t = await prisma.tenant.findUnique({ where: { id: ctx.tenantId } });
    expect(t.slug).toBe('tgt-test');
    await prisma.tenant.delete({ where: { id: ctx.tenantId } });
    await expect(
      prisma.$transaction((tx) => new DedicatedDeploymentTarget().prepare({ slug: 'x', name: 'x', region: 'eu' }, tx)),
    ).rejects.toThrow(/deferred/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:api -- provision-tenant`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `target.ts`**

```ts
import { Prisma } from '@prisma/client';

export interface TenantContext { tenantId: string; slug: string; }

export interface ProvisioningTarget {
  prepare(
    args: { slug: string; name: string; region: string; tenantId?: string },
    tx: Prisma.TransactionClient,
  ): Promise<TenantContext>;
}

export class SharedDbTarget implements ProvisioningTarget {
  async prepare(args: { slug: string; name: string; region: string; tenantId?: string }, tx: Prisma.TransactionClient): Promise<TenantContext> {
    const tenant = await tx.tenant.create({
      data: { ...(args.tenantId ? { id: args.tenantId } : {}), slug: args.slug, name: args.name, region: args.region, status: 'ACTIVE', tenancyMode: 'SHARED' },
    });
    return { tenantId: tenant.id, slug: tenant.slug };
  }
}

export class DedicatedDeploymentTarget implements ProvisioningTarget {
  async prepare(): Promise<TenantContext> {
    throw new Error('Dedicated deployment is deferred to a future spec');
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api -- provision-tenant` + `cd server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/provisioning/target.ts tests/api/provision-tenant.test.mjs
git commit -m "feat(provisioning): ProvisioningTarget interface + SharedDbTarget (dedicated stubbed)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: provisionTenant interpreter (atomic)

**Files:**
- Create: `server/src/domain/provisioning/provisionTenant.ts`
- Test: `tests/api/provision-tenant.test.mjs` (provision a small blueprint)

**Interfaces:**
- Consumes: `BlueprintSpec` (Task 2), `ProvisioningTarget`/`SharedDbTarget`/`TenantContext` (Task 3), `prisma`.
- Produces:
  - `interface ProvisioningResult { tenantId: string; slug: string; adminLoginOrInviteLink: string; }`
  - `async function provisionTenant(args: { blueprint: { id?: string; spec: BlueprintSpec }; inputs: Record<string, unknown>; target: ProvisioningTarget; tenantId?: string; idempotencyKey?: string }): Promise<ProvisioningResult>` — validates `inputs` against `spec.inputs`, then runs ONE `prisma.$transaction`: `target.prepare()` → org tree (parents before children) → roles → field-rules → tracks+stages (`TrackDef`/`StageDef`) → stage config (`StageConfig`) → cross-triggers → entity-types+field-defs → optional `seed` entities → admin user (argon2 hash if `adminUser.password`, else an invite token). Every row stamped with `ctx.tenantId`. Returns the result.

- [ ] **Step 1: Write the failing test**

```js
// add to tests/api/provision-tenant.test.mjs
import { SPEC_VERSION } from '@dlpe/shared';

const SMALL_SPEC = {
  specVersion: SPEC_VERSION,
  inputs: [{ key: 'customerName', label: 'Customer', type: 'string', required: true }],
  orgStructure: { id: 'grp', kind: 'group', name: 'Acme Group', code: 'ACME', children: [
    { id: 'cmp-acme', kind: 'company', name: 'Acme Co', code: 'ACME-1', children: [] } ] },
  roles: [{ id: 'group-admin', name: 'Group admin', system: true, tracks: ['All'], edit: 'all', desc: 'admin' }],
  fieldRules: [],
  tracks: [{ key: 'sales', label: 'Sales', order: 0, builtin: true, stages: [
    { stageId: 'lead', label: 'Lead', sla: 0, cta: 'Qualify', order: 0 } ] }],
  entityTypes: [{ key: 'contract', label: 'Contract', kind: 'pipeline', trackKey: 'sales', order: 0, builtin: true, fields: [] }],
  crossTriggers: [],
  adminUser: { idPrefix: 'u', name: 'Acme Admin', email: 'admin@acme.io', roleId: 'group-admin', scopeType: 'group', password: 'demo1234' },
};

describe('provisionTenant', () => {
  it('provisions a complete isolated tenant from a blueprint', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const res = await provisionTenant({
      blueprint: { spec: SMALL_SPEC }, inputs: { customerName: 'Acme' },
      target: new SharedDbTarget(), idempotencyKey: 'test-acme-1',
    });
    expect(res.tenantId).toBeTruthy();
    const tid = res.tenantId;
    expect(await prisma.orgNode.count({ where: { tenantId: tid } })).toBe(2);
    expect(await prisma.role.count({ where: { tenantId: tid } })).toBe(1);
    expect(await prisma.trackDef.count({ where: { tenantId: tid } })).toBe(1);
    expect(await prisma.entityType.count({ where: { tenantId: tid } })).toBe(1);
    expect(await prisma.user.count({ where: { tenantId: tid } })).toBe(1);
    // cleanup
    await prisma.user.deleteMany({ where: { tenantId: tid } });
    await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
    await prisma.entityType.deleteMany({ where: { tenantId: tid } });
    await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
    await prisma.role.deleteMany({ where: { tenantId: tid } });
    await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
    await prisma.tenant.delete({ where: { id: tid } });
  });

  it('rejects inputs that miss a required field', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    await expect(provisionTenant({
      blueprint: { spec: SMALL_SPEC }, inputs: {}, target: new SharedDbTarget(), idempotencyKey: 'test-acme-bad',
    })).rejects.toThrow(/customerName/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:api -- provision-tenant`
Expected: FAIL — `provisionTenant` not found.

- [ ] **Step 3: Implement `provisionTenant.ts`**

Implement per the Interfaces block. Key points:
- **Input validation:** build a Zod object from `spec.inputs` (required → non-optional) and `safeParse(inputs)`; on failure throw `Error('Invalid inputs: ' + <missing keys>)` (the message must include offending keys so callers/the future wizard get per-field feedback).
- **Slug:** derive from `inputs.slug` if present else slugify `inputs.customerName`/`spec.adminUser`. The demo passes an explicit slug via inputs.
- **Transaction:** `await prisma.$transaction(async (tx) => { ... })`. Inside: `const ctx = await target.prepare({ slug, name, region, tenantId }, tx)`. Walk `orgStructure` depth-first, inserting each node with `parentId` + `tenantId: ctx.tenantId`. Insert roles (`createMany`), fieldRules, tracks→`trackDef.create` capturing the generated id, its stages→`stageDef.createMany` + matching `StageConfig` rows (map track key→`Track` enum via the existing `TRACK_ENUM`), crossTriggers, entityTypes→`entityType.create` capturing id, fieldDefs, optional `seed.entities` (write Entity rows — reuse the demo's seed payload shape), and the admin user (argon2 hash when `password` set, else generate an invite token string). Everything stamped `tenantId`.
- **Idempotency:** before doing work, `upsert`/`create` a `ProvisioningRun` with the `idempotencyKey`; if a `SUCCEEDED` run with that key exists, return its prior result without re-provisioning. On success set `status: 'SUCCEEDED'`, `tenantId`, `finishedAt`; on throw the transaction rolls back the rows and you record a `FAILED` run (outside the rolled-back tx) with the error. (Write the ProvisioningRun status updates OUTSIDE the data transaction so a rollback doesn't erase the audit of the failure.)
- **Return:** `{ tenantId, slug, adminLoginOrInviteLink }` — for a password admin, a login hint (`/login?email=...`); for invite, `/invite/<token>`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/prepare-db.mjs && npm run test:api -- provision-tenant` + `cd server && npx tsc --noEmit`
Expected: PASS (both provision + rejects-bad-inputs).

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/provisioning/provisionTenant.ts tests/api/provision-tenant.test.mjs
git commit -m "feat(provisioning): provisionTenant interpreter (atomic, input-validated)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Idempotency + ProvisioningRun behavior

**Files:**
- Modify: `server/src/domain/provisioning/provisionTenant.ts` (if Task 4 left idempotency partial)
- Test: `tests/api/provision-idempotency.test.mjs`

**Interfaces:**
- Consumes: `provisionTenant` (Task 4).
- Produces: re-running with the same `idempotencyKey` returns the original result and creates NO duplicate tenant/rows; a `ProvisioningRun` row records each attempt's status.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/provision-idempotency.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { SPEC_VERSION } from '@dlpe/shared';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

const SPEC = {
  specVersion: SPEC_VERSION, inputs: [],
  orgStructure: { id: 'grp', kind: 'group', name: 'Idem', code: 'IDM', children: [] },
  roles: [{ id: 'group-admin', name: 'Admin', system: true, tracks: ['All'], edit: 'all', desc: 'a' }],
  fieldRules: [], tracks: [], entityTypes: [], crossTriggers: [],
  adminUser: { idPrefix: 'u', name: 'A', email: 'a@idem.io', roleId: 'group-admin', scopeType: 'group', password: 'demo1234' },
};

describe('provisioning idempotency', () => {
  it('re-running the same idempotencyKey does not duplicate', async () => {
    const { provisionTenant } = await import('../../server/src/domain/provisioning/provisionTenant.ts');
    const { SharedDbTarget } = await import('../../server/src/domain/provisioning/target.ts');
    const args = { blueprint: { spec: SPEC }, inputs: { slug: 'idem-co' }, target: new SharedDbTarget(), idempotencyKey: 'idem-key-1' };
    const r1 = await provisionTenant(args);
    const r2 = await provisionTenant(args);
    expect(r2.tenantId).toBe(r1.tenantId);
    expect(await prisma.tenant.count({ where: { slug: 'idem-co' } })).toBe(1);
    expect(await prisma.user.count({ where: { tenantId: r1.tenantId } })).toBe(1);
    // cleanup
    await prisma.user.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.role.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.orgNode.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.provisioningRun.deleteMany({ where: { tenantId: r1.tenantId } });
    await prisma.tenant.delete({ where: { id: r1.tenantId } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails (or passes if Task 4 fully covered it)**

Run: `node tests/prepare-db.mjs && npm run test:api -- provision-idempotency`
Expected: FAIL if Task 4's idempotency was incomplete (duplicate tenant) — then implement; if it already passes, note that and proceed (Task 4 covered it).

- [ ] **Step 3: Make idempotency robust**

Ensure: a `SUCCEEDED` `ProvisioningRun` with the key short-circuits and returns `{ tenantId, slug, adminLoginOrInviteLink }` reconstructed from the stored run/tenant. A `PENDING`/`FAILED` run with the key is allowed to retry. Guard slug uniqueness: if the `Tenant.slug` unique constraint trips for a *different* key, throw `Error('slug already in use: <slug>')`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api -- provision-idempotency`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/provisioning/provisionTenant.ts tests/api/provision-idempotency.test.mjs
git commit -m "feat(provisioning): idempotent re-runs via ProvisioningRun key

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: captureBlueprint (clone-from-live)

**Files:**
- Create: `server/src/domain/provisioning/captureBlueprint.ts`
- Test: `tests/api/capture-blueprint.test.mjs`

**Interfaces:**
- Consumes: `prisma`, `BlueprintSpec`, the seeded demo tenant (`tenant-dlpe-demo`).
- Produces: `async function captureBlueprint(prisma, tenantId: string): Promise<BlueprintSpec>` — reads the tenant's OrgNode tree, roles, field-rules, tracks/stages (+StageConfig), cross-triggers, entity-types/field-defs into a valid `BlueprintSpec` (with `seed` omitted — config only, NOT business rows). The result must pass `BlueprintSpec.safeParse`.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/capture-blueprint.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { BlueprintSpec } from '@dlpe/shared';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('captureBlueprint', () => {
  it('captures the demo tenant config into a valid BlueprintSpec', async () => {
    const { captureBlueprint } = await import('../../server/src/domain/provisioning/captureBlueprint.ts');
    const spec = await captureBlueprint(prisma, 'tenant-dlpe-demo');
    expect(BlueprintSpec.safeParse(spec).success).toBe(true);
    expect(spec.roles.length).toBeGreaterThan(0);
    expect(spec.tracks.length).toBeGreaterThan(0);
    expect(spec.orgStructure.kind).toBe('group');
    expect(spec.seed).toBeUndefined(); // config only, no business rows
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/prepare-db.mjs && npm run test:api -- capture-blueprint`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `captureBlueprint.ts`**

Read the tenant's rows (`where: { tenantId }`) and assemble a `BlueprintSpec`: rebuild the OrgNode tree from the flat list (root = the `GROUP` node, nest by `parentId`); map roles/fieldRules/crossTriggers directly; map `TrackDef`+`StageDef` into `tracks[]` (and reconcile with `StageConfig`); map `EntityType`+`FieldDef` into `entityTypes[]`. Set `specVersion: SPEC_VERSION`, `inputs: []` (a captured blueprint is concrete), a synthesized `adminUser` referencing `group-admin`, and OMIT `seed`. Validate with `BlueprintSpec.parse(...)` before returning so a malformed capture fails loudly.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api -- capture-blueprint` + `cd server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/provisioning/captureBlueprint.ts tests/api/capture-blueprint.test.mjs
git commit -m "feat(provisioning): captureBlueprint reads a live tenant config into a BlueprintSpec

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Platform-admin tier + minimal /api/platform API

**Files:**
- Create: `server/src/auth/platform.ts`, `server/src/routes/platform.ts`
- Modify: `server/src/index.ts`, `server/src/auth/AuthProvider.ts`, `server/src/auth/JwtAuthProvider.ts`
- Test: `tests/api/platform-api.test.mjs`

**Interfaces:**
- Consumes: `provisionTenant` (Task 4), `captureBlueprint` (Task 6), `BlueprintSpec` (Task 2), `User.platformAdmin` (Task 1).
- Produces:
  - `AuthUser.platformAdmin: boolean` (loaded in `toAuthUser`).
  - `isPlatformAdmin(req)`, `requirePlatformAdmin` middleware (401 if unauth, 403 if `!req.user.platformAdmin`).
  - Routes under `/api/platform`: `POST /tenants` (`{ blueprintKey, inputs, idempotencyKey }` → provisions, returns `ProvisioningResult`), `GET /tenants` (list `Tenant` rows), `GET /blueprints`, `POST /blueprints` (`{ key, name, spec }` — validates spec with `BlueprintSpec`), `GET /blueprints/:id/export` (returns spec JSON), `POST /blueprints/import` (`{ key, name, spec }`).

- [ ] **Step 1: Write the failing test**

```js
// tests/api/platform-api.test.mjs
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, post, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

// a platform-admin principal + a normal (tenant) admin
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
beforeAll(async () => { await prisma.user.update({ where: { id: 'u-robert' }, data: { platformAdmin: true } }); });
afterAll(async () => {
  await prisma.user.update({ where: { id: 'u-robert' }, data: { platformAdmin: false } });
  await prisma.$disconnect();
});

describe('platform API', () => {
  it('non-platform-admin is 403 on /api/platform', async () => {
    const r = await get('/platform/tenants', token('u-markus', 'm.weber@group.eu', 'sales-mgr'));
    expect(r.status).toBe(403);
  });
  it('platform-admin lists tenants and blueprints', async () => {
    expect((await get('/platform/tenants', PLATFORM())).status).toBe(200);
    expect((await get('/platform/blueprints', PLATFORM())).status).toBe(200);
  });
});
```

> Note: the test must mint a token AFTER setting `platformAdmin: true`. Since the JWT only carries `sub`, and `toAuthUser` reloads from the DB, flipping the column then calling with `u-robert`'s token is enough — `toAuthUser` will read `platformAdmin: true`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/prepare-db.mjs && npm run test:api -- platform-api`
Expected: FAIL — `/platform` routes 404 / `platformAdmin` not on principal.

- [ ] **Step 3: Implement the tier + routes + wiring**

- `AuthProvider.ts`: add `platformAdmin: boolean` to `AuthUser`. `JwtAuthProvider.toAuthUser`: include `platformAdmin: user.platformAdmin`.
- `auth/platform.ts`:
  ```ts
  import type { Request, Response, NextFunction } from 'express';
  export function isPlatformAdmin(req: Request): boolean { return !!req.user?.platformAdmin; }
  export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!req.user.platformAdmin) return res.status(403).json({ error: 'Platform admin access required' });
    next();
  }
  ```
- `routes/platform.ts`: a Router with the endpoints above; `POST /tenants` loads the `Blueprint` by `blueprintKey`, calls `provisionTenant({ blueprint: { id, spec }, inputs, target: new SharedDbTarget(), idempotencyKey })`; `POST /blueprints` + `/import` validate the body's `spec` with `BlueprintSpec.safeParse` (400 on failure).
- `index.ts`: `import { platformRouter } from './routes/platform.js'; import { requirePlatformAdmin } from './auth/platform.js';` then `app.use('/api/platform', requirePlatformAdmin, platformRouter);` — mount AFTER `requireAuth` + `tenantContext` (platform routes run as the owner client internally, not tenant-scoped reads).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api -- platform-api` + `cd server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `node tests/prepare-db.mjs && npm run test:api`
Expected: all prior tests green + the new platform tests.

- [ ] **Step 6: Commit**

```bash
git add server/src/auth/platform.ts server/src/routes/platform.ts server/src/index.ts server/src/auth tests/api/platform-api.test.mjs
git commit -m "feat(provisioning): platform-admin tier + minimal /api/platform API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Dogfood — seed.ts becomes the dlpe-demo blueprint

**Files:**
- Create: `server/src/domain/provisioning/dlpeDemoBlueprint.ts`
- Modify: `server/prisma/seed.ts`
- Test: `tests/api/dogfood-seed.test.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `dlpeDemoBlueprint: { key: 'dlpe-demo'; name; spec: BlueprintSpec }` + `demoInputs` (incl. explicit `slug: 'dlpe-demo'` and the fixed tenant id). `seed.ts` provisions it. The provisioned demo reproduces today's data (same row counts), keeping the existing 77 tests green.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/dogfood-seed.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
afterAll(() => prisma.$disconnect());

describe('dogfood: demo provisioned from blueprint', () => {
  it('the dlpe-demo tenant exists and carries the expected shape', async () => {
    const t = await prisma.tenant.findUnique({ where: { slug: 'dlpe-demo' } });
    expect(t?.id).toBe('tenant-dlpe-demo');
    const tid = 'tenant-dlpe-demo';
    expect(await prisma.orgNode.count({ where: { tenantId: tid } })).toBe(11); // grp+region+4 countries+... (match current seed)
    expect(await prisma.role.count({ where: { tenantId: tid } })).toBe(11);
    expect(await prisma.user.count({ where: { tenantId: tid } })).toBe(9);
    // a PUBLISHED dlpe-demo blueprint row exists
    const bp = await prisma.blueprint.findUnique({ where: { key: 'dlpe-demo' } });
    expect(bp?.status).toBe('PUBLISHED');
  });
});
```

> Before writing, the implementer MUST read the current `seed.ts` and confirm the exact expected counts (org nodes, roles, users) and substitute them into the assertions — do not guess. The current seed creates: org nodes (grp + 1 region + 4 countries? — count from GROUP_TREE), 11 roles, 9 users.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/prepare-db.mjs && npm run test:api -- dogfood-seed`
Expected: FAIL — no `dlpe-demo` Blueprint row yet (seed still uses the old path).

- [ ] **Step 3: Build the demo blueprint + rewire the seed**

- `dlpeDemoBlueprint.ts`: construct a `BlueprintSpec` literal from the existing `seed.ts` data (GROUP_TREE → orgStructure; ROLES → roles; FIELD_RULES → fieldRules; STAGE_CONFIG/CROSS_TRIGGERS/meta-model → tracks+entityTypes+crossTriggers; ADMIN_USERS + the seed cards/timeline/portal/integrations/audit/reports → `spec.seed` as the toggleable demo payload; `adminUser` = robert/group-admin). Keep the data verbatim so counts match. Export `demoInputs = { slug: 'dlpe-demo', customerName: 'DLPE Demo', region: 'eu' }` and the fixed `tenantId: 'tenant-dlpe-demo'`.
- `seed.ts`: replace the body of `main()` with: seed the global `CountryDefaults` (unchanged — not tenant-scoped), upsert the `dlpe-demo` Blueprint row (`status: 'PUBLISHED'`), then `await provisionTenant({ blueprint: { id, spec: dlpeDemoBlueprint.spec }, inputs: demoInputs, target: new SharedDbTarget(), tenantId: 'tenant-dlpe-demo', idempotencyKey: 'seed-dlpe-demo' })`. Keep the existing wipe (`deleteMany`) preamble. The interpreter must write the `seed.entities` payload (cards/vehicles via the existing `cardToEntityCreate`/`vehicleToEntityCreate`, timeline, portal, integrations, audit, reports, dashboard) so the demo is byte-equivalent to today.
- This is the engine's best integration test: if the suite stays green, the blueprint faithfully reproduces the hand-seed.

- [ ] **Step 4: Run the dogfood test + the FULL suite**

Run: `node tests/prepare-db.mjs && npm run test:api`
Expected: `dogfood-seed` green AND all prior 77+ tests still green (the demo data is reproduced faithfully). Investigate any count mismatch against the old seed and fix the blueprint until parity holds.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/provisioning/dlpeDemoBlueprint.ts server/prisma/seed.ts tests/api/dogfood-seed.test.mjs
git commit -m "feat(provisioning): dogfood seed via dlpe-demo blueprint + provisionTenant

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (against `2026-06-02-customer-provisioning-design.md` §2–4):**
- Blueprint table (DB-backed, JSON spec, status, sourceTenantId) → Task 1 ✅
- Declarative Zod spec with specVersion + all sections → Task 2 ✅
- `ProvisioningTarget` (SharedDbTarget impl, Dedicated stub) → Task 3 ✅
- `provisionTenant` atomic interpreter, input validation, admin user → Task 4 ✅
- Idempotency via `ProvisioningRun` + slug collision handling → Task 5 ✅
- `captureBlueprint` (clone-from-live, config-not-rows) → Task 6 ✅
- Platform-admin tier + minimal `/api/platform/*` (tenants, blueprints, export/import) → Task 7 ✅
- Dogfood seed.ts → first PUBLISHED `dlpe-demo` blueprint → Task 8 ✅
- Testing: provision into clean DB asserts rows + tenant-scoped (Task 4), idempotency (Task 5), bad inputs structured error (Task 4), capture validity (Task 6) ✅
- Out of scope (correctly deferred): RLS isolation test for provisioned tenants is covered by S0; the guided wizard (S3), control plane UI (S4), self-serve (S5) are later subsystems.

**Placeholder scan:** No TBD/TODO. Two places intentionally defer concrete values to the implementer with explicit instruction to read the source first: the demo row counts in Task 8 (must be read from `seed.ts`, not guessed) and the large `seed.entities` payload (transcribed from existing seed data, not re-invented). These are transcription-from-source, not hidden logic.

**Type consistency:** `BlueprintSpec`/`SPEC_VERSION` (Task 2) consumed identically in Tasks 4/6/7/8. `ProvisioningTarget`/`TenantContext`/`SharedDbTarget` (Task 3) consumed in Tasks 4/7/8. `ProvisioningResult { tenantId, slug, adminLoginOrInviteLink }` (Task 4) returned by Task 7's `POST /tenants`. `AuthUser.platformAdmin` (Task 7) ↔ `User.platformAdmin` (Task 1). Demo ids `tenant-dlpe-demo`/`dlpe-demo` consistent with S0.

## Notes for the implementer
- **Risk gradient:** Tasks 1–3 are additive/low-risk. Task 4 is the core engine. Task 8 is the highest-risk (must reproduce the hand-seed exactly) — converge on parity by diffing row counts against the pre-change seed; if a count differs, the blueprint is missing data, not the test being wrong.
- Provisioning runs as the **owner** `prisma` (bypasses RLS) — correct, since it creates a brand-new tenant's rows. Do NOT route provisioning through `withTenant`.
- After this plan, S0+S1 together deliver "launch a customer in minutes" (engine) + isolation (S0). Next subsystems (control-plane UI, wizard, billing, self-serve) are separate specs per the roadmap.
