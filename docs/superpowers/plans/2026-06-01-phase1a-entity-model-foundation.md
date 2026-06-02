# Phase 1a — Entity Model Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the data-driven entity meta-model (`TrackDef`, `StageDef`, `EntityType`, `FieldDef`, `Entity`) as a parallel structure backfilled from the existing `Card`/`Vehicle`/`StageConfig` rows, and prove via tests that it projects back to byte-identical DTOs — with no change to any live read path.

**Architecture:** Purely additive. The existing `Card`/`Vehicle`/`Track`-enum world keeps serving every request unchanged. We add new tables, an idempotent backfill that derives entity rows from the existing rows (carrying a denormalized `tenantId`), and pure projection functions `entityToCardDTO` / `entityToVehicleDTO`. Parity tests assert the projection of each backfilled entity deep-equals the original row. No route, service, or frontend file is modified — those move in Phase 1b.

**Tech Stack:** Prisma 6 + Postgres 16, TypeScript (server, ESM, `.js` import specifiers), Vitest (API test harness on port 4100 with `intelligence_test`).

**Scope guard (this plan):** new tables + backfill + projection + parity tests only. **Out of scope here:** repointing live services (1b), RLS policy enforcement (1c), physical partitioning (1d). The `tenantId` *column* and its backfill ARE in scope (cheap now, expensive to retrofit); RLS *enforcement* is not.

---

### Reference: taxonomy this plan locks in

Backfill creates these `EntityType` rows (one pipeline type per track + reference types):

| key | label | kind | trackId (key) | FieldDefs source |
|---|---|---|---|---|
| `contract` | Contract | pipeline | `sales` | `DATA_TYPES['contract']` |
| `operation` | Operation | pipeline | `operations` | none (added in a later phase) |
| `workshop_order` | Workshop order | pipeline | `workshop` | `DATA_TYPES['workshop_order']` |
| `invoice` | Invoice | pipeline | `finance` | `DATA_TYPES['invoice']` |
| `vehicle` | Vehicle | reference | — | `DATA_TYPES['vehicle']` |
| `fleet_operator` | Fleet operator | reference | — | `DATA_TYPES['fleet_operator']` |

`TrackDef` keys are the existing `TRACK_KEYS` (`sales`, `operations`, `workshop`, `finance`). A `Card` maps to the pipeline `EntityType` for its track; its original `type` string (e.g. `RENEWAL`) is preserved in `Entity.fields.type` so projection is lossless. `tenantId` = the `GROUP` ancestor of the row's company (or the sole `GROUP` node when `companyId` is null).

---

### Task 1: Add the new Prisma models (additive)

**Files:**
- Modify: `server/prisma/schema.prisma` (append new models after `PortalMessage`, line ~380)

- [ ] **Step 1: Append the new models to the schema**

Add at the end of `server/prisma/schema.prisma`:

```prisma
// ---------------- Generic entity meta-model (Phase 1a, parallel to Card/Vehicle) ----------------
model TrackDef {
  id      String     @id @default(cuid())
  key     String     @unique
  label   String
  color   String?
  icon    String?
  order   Int        @default(0)
  builtin Boolean    @default(false)
  stages  StageDef[]
  types   EntityType[]
}

model StageDef {
  id      String   @id @default(cuid())
  trackId String
  track   TrackDef @relation(fields: [trackId], references: [id], onDelete: Cascade)
  order   Int
  stageId String
  label   String
  sla     Int      @default(0)
  lock    String?
  cta     String   @default("")

  @@unique([trackId, stageId])
  @@index([trackId, order])
}

model EntityType {
  id        String      @id @default(cuid())
  key       String      @unique
  label     String
  kind      String // 'pipeline' | 'reference'
  trackId   String?
  track     TrackDef?   @relation(fields: [trackId], references: [id])
  icon      String?
  color     String?
  order     Int         @default(0)
  builtin   Boolean     @default(false)
  fieldDefs FieldDef[]
  entities  Entity[]
}

model FieldDef {
  id           String     @id @default(cuid())
  entityTypeId String
  entityType   EntityType @relation(fields: [entityTypeId], references: [id], onDelete: Cascade)
  key          String
  label        String
  category     String?
  dataKind     String     @default("text") // text|money|date|select|number|bool
  order        Int        @default(0)
  builtin      Boolean    @default(false)

  @@unique([entityTypeId, key])
  @@index([entityTypeId, order])
}

model Entity {
  id           String     @id
  tenantId     String?
  entityTypeId String
  entityType   EntityType @relation(fields: [entityTypeId], references: [id])
  companyId    String?
  company      OrgNode?   @relation(fields: [companyId], references: [id])

  // shared display envelope (indexed scalar columns)
  title   String
  value   Int?
  owner   String?
  status  String?
  sub     String?
  sources String[]
  fields  Json?
  archived Boolean   @default(false)

  // pipeline-kind only (null for reference)
  trackId      String?
  stageId      String?
  stageName    String?
  days         Int      @default(0)
  daysLabel    String?
  cta          String?
  awaitingSign Boolean  @default(false)

  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([tenantId, companyId, entityTypeId, trackId, stageId])
  @@index([tenantId, trackId, stageId, status])
}
```

- [ ] **Step 2: Add the `Entity[]` back-relation to `OrgNode`**

In `server/prisma/schema.prisma`, find the `OrgNode` model's relation block (lines 70-75) and add `entities`:

```prisma
  cards         Card[]
  vehicles      Vehicle[]
  fleetOps      FleetOperator[]
  invoices      Invoice[]
  entities      Entity[]
  usersPrimary  User[]          @relation("UserPrimaryScope")
  userScopes    UserScope[]
```

- [ ] **Step 3: Create the migration**

Run: `cd "$(git rev-parse --show-toplevel)" && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/intelligence" npx -w server prisma migrate dev --name entity_model_foundation`

Expected: a new folder under `server/prisma/migrations/` (e.g. `2026..._entity_model_foundation`), output `Your database is now in sync with your schema`, and the Prisma client regenerates. The migration is additive — no existing table is altered except `OrgNode` gaining a back-relation (no SQL column change).

- [ ] **Step 4: Verify the client typechecks**

Run: `npm run -w server typecheck`
Expected: no output (exit 0). Confirms `prisma.entity`, `prisma.entityType`, `prisma.trackDef`, `prisma.stageDef`, `prisma.fieldDef` are now typed.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations
git commit -m "Phase 1a: add entity meta-model tables (additive)"
```

---

### Task 2: tenantId resolver helper

**Files:**
- Create: `server/src/domain/tenancy.ts`
- Test: `tests/api/tenancy-resolver.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/api/tenancy-resolver.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { get, ADMIN } from '../helpers.mjs';

// The resolver is exercised indirectly: after backfill (Task 4) every entity
// must carry the group tenantId. Here we assert the seed's org tree has exactly
// one GROUP node, which the resolver depends on as the fallback tenant.
describe('tenancy: org tree shape', () => {
  it('exposes a single GROUP node via /admin/structure', async () => {
    const r = await get('/admin/structure', ADMIN());
    expect(r.status).toBe(200);
    // root of the structure tree is the GROUP
    expect(r.body.kind).toBe('GROUP');
    expect(typeof r.body.id).toBe('string');
  });
});
```

- [ ] **Step 2: Run it to confirm the harness + assumption hold**

Run: `npm run test:api -- tenancy-resolver`
Expected: PASS (the seed has one GROUP root, id `grp`). If it fails, stop — the backfill's tenant fallback assumption is wrong and must be revisited.

- [ ] **Step 3: Implement the resolver**

Create `server/src/domain/tenancy.ts`:

```ts
import type { PrismaClient } from '@prisma/client';

// Resolve the tenant (top-level GROUP node id) for a given company by walking
// the OrgNode parent chain. Falls back to the sole GROUP node when companyId is
// null/unknown. Pure over a preloaded node map for O(depth) lookups in backfill.
export interface OrgNodeLite { id: string; kind: string; parentId: string | null }

export function buildTenantResolver(nodes: OrgNodeLite[]): (companyId: string | null) => string | null {
  const byId = new Map<string, OrgNodeLite>();
  for (const n of nodes) byId.set(n.id, n);
  const soleGroup = nodes.find((n) => n.kind === 'GROUP')?.id ?? null;

  return (companyId: string | null): string | null => {
    let cur = companyId ? byId.get(companyId) : undefined;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      if (cur.kind === 'GROUP') return cur.id;
      seen.add(cur.id);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return soleGroup;
  };
}

export async function loadTenantResolver(prisma: PrismaClient) {
  const nodes = await prisma.orgNode.findMany({ select: { id: true, kind: true, parentId: true } });
  return buildTenantResolver(nodes);
}
```

- [ ] **Step 4: Run the test again**

Run: `npm run test:api -- tenancy-resolver`
Expected: still PASS (the helper isn't imported by routes yet; this confirms no regression).

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/tenancy.ts tests/api/tenancy-resolver.test.mjs
git commit -m "Phase 1a: tenant resolver (group ancestor of a company)"
```

---

### Task 3: Projection functions (Entity → existing DTOs)

**Files:**
- Create: `server/src/domain/projection.ts`
- Test: `server/test/projection.unit.test.ts` is NOT used; use the API harness style instead — Test: `tests/api/projection-unit.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/api/projection-unit.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { entityToCardDTO, entityToVehicleDTO } from '../../server/src/domain/projection.ts';

// Pure-function parity: a synthetic pipeline entity projects to the exact Card
// DTO shape the frontend expects; a reference entity projects to the vehicle shape.
describe('projection functions', () => {
  it('projects a pipeline entity to a Card DTO', () => {
    const entity = {
      id: 's5', companyId: 'cmp-brussels', trackId: 'sales',
      title: 'Brussels Energy SA', value: 120000, owner: 'Eva de Vries',
      status: 'amber', sub: 'Renewal · 14 vehicles', sources: ['CRM'],
      stageId: 'contract', stageName: 'Contract', days: 3, daysLabel: '3d in stage',
      cta: 'Review contract', awaitingSign: true,
      fields: { type: 'RENEWAL', vehicle: 'BX-1234', meta: { foo: 1 } },
      createdById: null,
    };
    expect(entityToCardDTO(entity)).toEqual({
      id: 's5', companyId: 'cmp-brussels', track: 'SALES', type: 'RENEWAL',
      customer: 'Brussels Energy SA', value: 120000, vehicle: 'BX-1234',
      sub: 'Renewal · 14 vehicles', stageId: 'contract', stageName: 'Contract',
      days: 3, daysLabel: '3d in stage', owner: 'Eva de Vries', status: 'amber',
      cta: 'Review contract', sources: ['CRM'], awaitingSign: true,
      meta: { foo: 1 }, createdById: null,
    });
  });

  it('projects a reference entity to a Vehicle DTO', () => {
    const entity = {
      id: 'veh1', companyId: 'cmp-rotterdam', title: 'NL-AB-123',
      status: 'active',
      fields: { plate: 'NL-AB-123', model: 'VW ID.4', vin: 'WVW...', operator: 'Acme', statusLabel: 'On road', note: 'n/a' },
    };
    expect(entityToVehicleDTO(entity)).toEqual({
      id: 'veh1', plate: 'NL-AB-123', model: 'VW ID.4', vin: 'WVW...',
      operator: 'Acme', status: 'active', statusLabel: 'On road', note: 'n/a',
      companyId: 'cmp-rotterdam',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:api -- projection-unit`
Expected: FAIL with a module-not-found / `entityToCardDTO is not a function` error.

- [ ] **Step 3: Implement the projection**

Create `server/src/domain/projection.ts`:

```ts
import { TRACK_ENUM } from '@dlpe/shared';

// Minimal shapes the projection needs (a subset of the Prisma Entity row).
export interface EntityRow {
  id: string;
  companyId: string | null;
  trackId?: string | null;
  title: string;
  value?: number | null;
  owner?: string | null;
  status?: string | null;
  sub?: string | null;
  sources?: string[];
  stageId?: string | null;
  stageName?: string | null;
  days?: number;
  daysLabel?: string | null;
  cta?: string | null;
  awaitingSign?: boolean;
  fields?: Record<string, unknown> | null;
  createdById?: string | null;
}

// Project a pipeline entity back to the legacy Card DTO (byte-identical to what
// listCards/getCard return today). `trackId` holds the track KEY (e.g. 'sales');
// the DTO exposes the enum (e.g. 'SALES').
export function entityToCardDTO(e: EntityRow) {
  const f = (e.fields ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    companyId: e.companyId,
    track: TRACK_ENUM[String(e.trackId)] ?? null,
    type: (f.type as string) ?? null,
    customer: e.title,
    value: e.value ?? null,
    vehicle: (f.vehicle as string | null) ?? null,
    sub: e.sub ?? '',
    stageId: e.stageId ?? '',
    stageName: e.stageName ?? '',
    days: e.days ?? 0,
    daysLabel: e.daysLabel ?? null,
    owner: e.owner ?? '',
    status: e.status ?? '',
    cta: e.cta ?? '',
    sources: e.sources ?? [],
    awaitingSign: e.awaitingSign ?? false,
    meta: (f.meta as unknown) ?? null,
    createdById: e.createdById ?? null,
  };
}

// Project a reference (vehicle) entity back to the legacy Vehicle DTO.
export function entityToVehicleDTO(e: EntityRow) {
  const f = (e.fields ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    plate: (f.plate as string) ?? e.title,
    model: (f.model as string | null) ?? null,
    vin: (f.vin as string | null) ?? null,
    operator: (f.operator as string | null) ?? null,
    status: e.status ?? null,
    statusLabel: (f.statusLabel as string | null) ?? null,
    note: (f.note as string | null) ?? null,
    companyId: e.companyId,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:api -- projection-unit`
Expected: PASS (2 tests). Vitest imports the `.ts` directly via the existing esbuild transform; no build step needed.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/projection.ts tests/api/projection-unit.test.mjs
git commit -m "Phase 1a: Entity→Card/Vehicle projection functions"
```

---

### Task 4: Idempotent backfill (existing rows → entity model)

**Files:**
- Create: `server/src/domain/backfill.ts`
- Modify: `server/prisma/seed.ts` (call backfill at the end of the seed)

- [ ] **Step 1: Implement the backfill module**

Create `server/src/domain/backfill.ts`:

```ts
import type { PrismaClient } from '@prisma/client';
import { TRACK_KEYS, STAGE_CONFIG, DATA_TYPES, FIELD_CATEGORIES } from '@dlpe/shared';
import { loadTenantResolver } from './tenancy.js';

const TRACK_META: Record<string, { label: string; color: string; order: number }> = {
  sales: { label: 'Sales', color: 'var(--track-sales)', order: 0 },
  operations: { label: 'Operations', color: 'var(--track-ops)', order: 1 },
  workshop: { label: 'Workshop', color: 'var(--track-workshop)', order: 2 },
  finance: { label: 'Finance', color: 'var(--track-finance)', order: 3 },
};

// One pipeline EntityType per track; key reused for RBAC/data-type alignment.
const PIPELINE_TYPE: Record<string, { key: string; label: string }> = {
  sales: { key: 'contract', label: 'Contract' },
  operations: { key: 'operation', label: 'Operation' },
  workshop: { key: 'workshop_order', label: 'Workshop order' },
  finance: { key: 'invoice', label: 'Invoice' },
};

const REFERENCE_TYPES = [
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'fleet_operator', label: 'Fleet operator' },
];

const dataKindFor = (cat: string | undefined): string =>
  cat === 'Financial' ? 'money' : 'text';

// Idempotent: upserts every derived row by stable key/id, so it can run on every
// seed and on an already-migrated DB without duplicating.
export async function backfillEntities(prisma: PrismaClient): Promise<void> {
  // 1) Tracks
  const trackIdByKey: Record<string, string> = {};
  for (const key of TRACK_KEYS) {
    const meta = TRACK_META[key];
    const row = await prisma.trackDef.upsert({
      where: { key },
      update: { label: meta.label, color: meta.color, order: meta.order, builtin: true },
      create: { key, label: meta.label, color: meta.color, order: meta.order, builtin: true },
    });
    trackIdByKey[key] = row.id;
  }

  // 2) Stages (from STAGE_CONFIG, keyed by track key)
  for (const key of TRACK_KEYS) {
    const stages = STAGE_CONFIG[key] ?? [];
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      await prisma.stageDef.upsert({
        where: { trackId_stageId: { trackId: trackIdByKey[key], stageId: s.id } },
        update: { order: i, label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta },
        create: { trackId: trackIdByKey[key], order: i, stageId: s.id, label: s.label, sla: s.sla, lock: s.lock ?? null, cta: s.cta },
      });
    }
  }

  // 3) Entity types (pipeline per track + reference types) and their fields
  const typeIdByKey: Record<string, string> = {};
  const fieldsByTypeKey: Record<string, { id: string; label: string; cat: string }[]> = {};
  for (const dt of DATA_TYPES) fieldsByTypeKey[dt.id] = dt.fields;

  let order = 0;
  for (const key of TRACK_KEYS) {
    const t = PIPELINE_TYPE[key];
    const row = await prisma.entityType.upsert({
      where: { key: t.key },
      update: { label: t.label, kind: 'pipeline', trackId: trackIdByKey[key], order, builtin: true },
      create: { key: t.key, label: t.label, kind: 'pipeline', trackId: trackIdByKey[key], order, builtin: true },
    });
    typeIdByKey[t.key] = row.id;
    order++;
  }
  for (const rt of REFERENCE_TYPES) {
    const row = await prisma.entityType.upsert({
      where: { key: rt.key },
      update: { label: rt.label, kind: 'reference', trackId: null, order, builtin: true },
      create: { key: rt.key, label: rt.label, kind: 'reference', trackId: null, order, builtin: true },
    });
    typeIdByKey[rt.key] = row.id;
    order++;
  }
  // FieldDefs for any type that has a matching DATA_TYPES entry
  for (const [typeKey, defs] of Object.entries(fieldsByTypeKey)) {
    const entityTypeId = typeIdByKey[typeKey];
    if (!entityTypeId) continue;
    for (let i = 0; i < defs.length; i++) {
      const fd = defs[i];
      await prisma.fieldDef.upsert({
        where: { entityTypeId_key: { entityTypeId, key: fd.id } },
        update: { label: fd.label, category: fd.cat, dataKind: dataKindFor(fd.cat), order: i, builtin: true },
        create: { entityTypeId, key: fd.id, label: fd.label, category: fd.cat, dataKind: dataKindFor(fd.cat), order: i, builtin: true },
      });
    }
  }
  void FIELD_CATEGORIES; // categories are sourced from DATA_TYPES.fields[].cat

  // 4) Entities from Cards
  const tenantFor = await loadTenantResolver(prisma);
  const cards = await prisma.card.findMany();
  for (const c of cards) {
    const trackKey = c.track.toLowerCase();
    const typeKey = PIPELINE_TYPE[trackKey]?.key;
    if (!typeKey) continue;
    await prisma.entity.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        tenantId: tenantFor(c.companyId),
        entityTypeId: typeIdByKey[typeKey],
        companyId: c.companyId,
        title: c.customer,
        value: c.value,
        owner: c.owner,
        status: c.status,
        sub: c.sub,
        sources: c.sources,
        fields: { type: c.type, vehicle: c.vehicle, meta: c.meta },
        trackId: trackKey,
        stageId: c.stageId,
        stageName: c.stageName,
        days: c.days,
        daysLabel: c.daysLabel,
        cta: c.cta,
        awaitingSign: c.awaitingSign,
        createdById: c.createdById,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      },
    });
  }

  // 5) Entities from Vehicles (reference)
  const vehicles = await prisma.vehicle.findMany();
  for (const v of vehicles) {
    await prisma.entity.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        tenantId: tenantFor(v.companyId),
        entityTypeId: typeIdByKey['vehicle'],
        companyId: v.companyId,
        title: v.plate,
        status: v.status,
        sources: [],
        fields: { plate: v.plate, model: v.model, vin: v.vin, operator: v.operator, statusLabel: v.statusLabel, note: v.note, meta: v.meta },
      },
    });
  }
}
```

Note on `entity.trackId`: in this phase it stores the track **key** (`'sales'`), matching what `projection.entityToCardDTO` expects. It is intentionally NOT a FK in 1a (kept as a plain string) so the projection stays a pure string→enum map and the backfill needs no track-id join. Phase 1b decides whether to promote it to a `TrackDef` FK.

- [ ] **Step 2: Call backfill at the end of the seed**

In `server/prisma/seed.ts`, find the final `console.log('Login: ...')` line (≈ line 599) and add, immediately before it:

```ts
  // Phase 1a: derive the parallel entity model from the rows just seeded.
  const { backfillEntities } = await import('../src/domain/backfill.js');
  await backfillEntities(prisma);
  console.log('Backfilled entity model (tracks, types, fields, entities).');
```

- [ ] **Step 3: Re-seed the dev DB to run the backfill**

Run: `cd "$(git rev-parse --show-toplevel)" && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/intelligence" npx -w server prisma db seed`
Expected: ends with `Backfilled entity model (...)`. (`prisma migrate reset` is blocked for agents — use `db seed`, which is idempotent here.)

- [ ] **Step 4: Sanity-check counts in the DB**

Run: `docker exec il_postgres psql -U postgres -d intelligence -t -c "SELECT (SELECT count(*) FROM \"Entity\") AS entities, (SELECT count(*) FROM \"Card\") AS cards, (SELECT count(*) FROM \"Vehicle\") AS vehicles, (SELECT count(*) FROM \"Entity\" WHERE \"tenantId\" IS NULL) AS null_tenant;"`
Expected: `entities` = `cards` + `vehicles`; `null_tenant` = 0.

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/backfill.ts server/prisma/seed.ts
git commit -m "Phase 1a: idempotent backfill of entity model from cards/vehicles"
```

---

### Task 5: Projection-parity tests (against the real test DB)

**Files:**
- Modify: `tests/prepare-db.mjs` (ensure backfill runs in the test DB)
- Test: `tests/api/projection-parity.test.mjs`

- [ ] **Step 1: Ensure the test DB is backfilled**

Open `tests/prepare-db.mjs`. It runs `migrate deploy` + TRUNCATE + `db seed` against `intelligence_test`. Because Task 4 added `backfillEntities` to `seed.ts`, the test DB is backfilled automatically. Verify the seed step is present (no edit needed if `db seed` is already invoked). If `prepare-db.mjs` seeds via a direct function import rather than `prisma db seed`, add this line after its seed call:

```js
// Phase 1a: derive entity model in the test DB too.
const { backfillEntities } = await import('../server/src/domain/backfill.js');
await backfillEntities(prisma);
```

(If `prepare-db.mjs` shells out to `prisma db seed`, skip this — the seed already calls it.)

- [ ] **Step 2: Write the parity test**

Create `tests/api/projection-parity.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TEST_DB_URL } from '../helpers.mjs';
import { entityToCardDTO, entityToVehicleDTO } from '../../server/src/domain/projection.ts';

const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });

// The legacy Card/Vehicle row shaped exactly as listCards/getCard/fleet return it.
function cardToDTO(c) {
  return {
    id: c.id, companyId: c.companyId, track: c.track, type: c.type,
    customer: c.customer, value: c.value, vehicle: c.vehicle, sub: c.sub,
    stageId: c.stageId, stageName: c.stageName, days: c.days, daysLabel: c.daysLabel,
    owner: c.owner, status: c.status, cta: c.cta, sources: c.sources,
    awaitingSign: c.awaitingSign, meta: c.meta, createdById: c.createdById,
  };
}
function vehicleToDTO(v) {
  return {
    id: v.id, plate: v.plate, model: v.model, vin: v.vin, operator: v.operator,
    status: v.status, statusLabel: v.statusLabel, note: v.note, companyId: v.companyId,
  };
}

describe('projection parity: every backfilled entity matches its source row', () => {
  it('every Card has an Entity that projects to the identical Card DTO', async () => {
    const cards = await prisma.card.findMany();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      const e = await prisma.entity.findUnique({ where: { id: c.id } });
      expect(e, `entity for card ${c.id}`).toBeTruthy();
      expect(entityToCardDTO(e), `card ${c.id}`).toEqual(cardToDTO(c));
    }
  });

  it('every Vehicle has an Entity that projects to the identical Vehicle DTO', async () => {
    const vehicles = await prisma.vehicle.findMany();
    for (const v of vehicles) {
      const e = await prisma.entity.findUnique({ where: { id: v.id } });
      expect(e, `entity for vehicle ${v.id}`).toBeTruthy();
      expect(entityToVehicleDTO(e), `vehicle ${v.id}`).toEqual(vehicleToDTO(v));
    }
  });

  it('every entity carries a tenantId', async () => {
    const orphan = await prisma.entity.count({ where: { tenantId: null } });
    expect(orphan).toBe(0);
  });
});
```

- [ ] **Step 3: Run the parity test**

Run: `npm run test:api -- projection-parity`
Expected: PASS (3 tests). If a `meta`/`daysLabel`/`vehicle` field mismatches, fix the mapping in `projection.ts` or `backfill.ts` until the DTOs are byte-identical — do not change the legacy row shape.

- [ ] **Step 4: Run the full API suite (no regression)**

Run: `npm run test:api`
Expected: all prior tests still green (42) plus the new ones (tenancy-resolver 1, projection-unit 2, projection-parity 3) = 48.

- [ ] **Step 5: Commit**

```bash
git add tests/api/projection-parity.test.mjs tests/prepare-db.mjs
git commit -m "Phase 1a: projection-parity tests (entity ↔ legacy DTO)"
```

---

### Task 6: Document Phase 1a completion + the deferred 1b/1c/1d boundary

**Files:**
- Modify: `docs/superpowers/specs/2026-06-01-generic-entity-model-design.md` (append a status note)

- [ ] **Step 1: Append a status note to the spec**

Add to the end of the spec file:

```markdown
---

## Phase 1a status (implemented)

The parallel entity model is live and backfilled; projection parity is proven by
`tests/api/projection-parity.test.mjs`. No live read path changed yet.

**Deferred to follow-on plans (do not forget):**
- **1b** — repoint `cards.service`/`aggregations`/`scope`/`fleet` to read from
  `Entity` via the projection; replace `CARD_FIELD_MAP` with per-EntityType
  governance; SQL `GROUP BY` aggregation + scope `WHERE`; pagination.
- **1c** — Row-Level Security: `app.tenant` GUC set per request inside a
  transaction, RLS policies on `Entity`. (See project memory `tenancy-rls-decision`.)
- **1d** — physical partitioning of `Entity` by `entityTypeId`/`tenantId` (raw
  SQL migration), applied when volume warrants.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-01-generic-entity-model-design.md
git commit -m "Phase 1a: document completion + 1b/1c/1d boundary"
```

---

## Self-review

**Spec coverage (Phase 1a slice):** new tables (§3) → Task 1; tenantId foundation (§6) → Tasks 2, 4; projection shim (§5) → Tasks 3, 5; migration of real data (§5) → Task 4; testing/parity gate (§9) → Task 5. RLS enforcement (§6), SQL aggregation/scope + service repoint (§4, §5), partitioning (§4), and the admin UI (§7) are explicitly deferred to 1b/1c/1d/Phase 3 — recorded in Task 6. No Phase 1a requirement is unattended.

**Placeholder scan:** none — every code step contains full code; every command is exact with expected output. The one conditional (Task 5 Step 1) gives both branches explicitly.

**Type consistency:** `entityToCardDTO`/`entityToVehicleDTO` signatures and the `EntityRow` fields used in Task 3 match the `Entity` columns defined in Task 1 and the values written by the backfill in Task 4 (`fields.type`, `fields.vehicle`, `fields.meta`, `fields.plate`, etc.). `trackId` carries the track **key** consistently across backfill (Task 4) and projection (Task 3). Backfill upsert `where` clauses (`trackId_stageId`, `entityTypeId_key`, `key`, `id`) match the `@@unique`/`@id` constraints declared in Task 1.
