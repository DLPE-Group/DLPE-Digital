# Phase 1b — Services on the Entity model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Flip the live pipeline + reference read/write paths to operate on `Entity` (single source of truth), projecting to the legacy Card/Vehicle DTOs at the API boundary, so the frontend is unchanged and all existing tests stay green.

**Architecture:** Entity is now authoritative for pipeline items (cards) and reference items (vehicles). `cards.service` (list/get/move/patch), `actions`/`triggers` (writes + cascades), `aggregations`, and `fleet` (`/vehicles`, `/portal`) all read/write `Entity`. Existing RBAC (`filterCard`/`CARD_FIELD_MAP`), scope (`visibleCompanyIds`), and auto-escalate logic are **reused unchanged** — they run on projected Card DTOs, so behavior is identical. `Card`/`Vehicle` tables become dormant (not read/written). Per-EntityType field governance, SQL `GROUP BY`, and pagination are deferred to Phase 2.

**Tech Stack:** Prisma 6 + Postgres, TypeScript ESM, Vitest harness (48 tests must stay green).

**Key decision:** Entity = single source of truth (no dual-write). Reseeding/backfill remains the way demo data is loaded; the backfill stays convergent.

---

### Task 1: Entity→Card loader in cards.service

**Files:** Modify `server/src/domain/cards.service.ts`; reuse `server/src/domain/projection.ts`.

- [ ] **Step 1:** Add an internal loader that reads pipeline entities and projects them to Card DTOs, so the rest of `cards.service` keeps operating on Card-shaped objects.

```ts
import { entityToCardDTO } from './projection.js';
// ...
// Load pipeline entities (optionally one track) projected to legacy Card shape.
async function loadPipelineCards(trackKey?: string): Promise<Card[]> {
  const where: Prisma.EntityWhereInput = { entityType: { kind: 'pipeline' } };
  if (trackKey) where.trackId = trackKey;
  const rows = await prisma.entity.findMany({ where, orderBy: { id: 'asc' } });
  return rows.map((e) => entityToCardDTO(e as unknown as Parameters<typeof entityToCardDTO>[0]) as unknown as Card);
}
```

- [ ] **Step 2:** In `listCards`, replace `await prisma.card.findMany(...)` with `await loadPipelineCards(track)`; keep the rest (track-access, scope, filterCard, auto-escalate) unchanged. In `getCard`, replace `prisma.card.findUnique` with a projected entity lookup:

```ts
  const row = await prisma.entity.findUnique({ where: { id } });
  if (!row) return null;
  const card = entityToCardDTO(row as any) as unknown as Card;
```

- [ ] **Step 3:** Run `npm run -w server typecheck` (expect clean) and `npm run test:api -- cards rbac scope track-access` (expect green).
- [ ] **Step 4:** Commit `"Phase 1b: listCards/getCard read from Entity (projected)"`.

---

### Task 2: moveStage + patchCard write to Entity

**Files:** Modify `server/src/domain/cards.service.ts`.

- [ ] **Step 1:** In `moveStage`, read the source via `prisma.entity.findUnique({ where: { id } })`; compute `stage` from `loadStages(card.track)` using the projected track; update `prisma.entity.update({ where:{id}, data:{ stageId, stageName, days:0, daysLabel:'moved now', cta }})`; project the updated entity to a Card DTO for the return + audit. The lock-enforcement + audit logic is unchanged (operate on the projected card).
- [ ] **Step 2:** In `patchCard`, map the legacy allowed-field patch onto the Entity envelope/fields: `customer→title`, `value`, `owner`, `status`, `sub`, `sources`, `stageId`, `stageName`, `days`, `daysLabel`, `cta`, `awaitingSign` are columns; `type`/`vehicle`/`meta` go into `fields` (merge with existing `fields`). Update `prisma.entity.update`; project back.
- [ ] **Step 3:** `npm run test:api -- cards` (stage-lock test green).
- [ ] **Step 4:** Commit `"Phase 1b: moveStage/patchCard write to Entity"`.

---

### Task 3: actions + triggers write to Entity

**Files:** Modify `server/src/domain/actions.ts`, `server/src/domain/triggers.engine.ts`.

- [ ] **Step 1:** In `actions.runAction`, change `tx.card.findUnique`/`tx.card.update` to `tx.entity.findUnique`/`tx.entity.update`, projecting the entity to a Card DTO before applying `PATCHES[action]` and for the audit/return. The `PATCHES` map already returns Card-field patches; translate them to entity columns/`fields` via a small `cardPatchToEntity(patch)` helper (same field split as Task 2).
- [ ] **Step 2:** In `triggers.engine.buildCardForTrigger`, build an `Entity` create payload instead of a `Card` create payload: map `customer→title`, keep `value`/`owner`/`status`/`sub`/`sources`/`stageId`/`stageName`/`days`/`daysLabel`/`cta`/`awaitingSign`, set `trackId` to the lowercase track key, `entityTypeId` resolved from the track's pipeline type (look up `EntityType` by key: operations→`operation`, finance→`invoice`), `type`/`vehicle` into `fields`, `tenantId` via the tenant resolver, `company` connect by `companyId`. Deterministic ids `o1`/`f1` unchanged. `runTriggers` switches `tx.card.*` → `tx.entity.*` and projects created entities back to Card DTOs.
- [ ] **Step 3:** `npm run test:api -- actions-audit` (Brussels cascade + revert green).
- [ ] **Step 4:** Commit `"Phase 1b: actions + triggers write/cascade on Entity"`.

---

### Task 4: aggregations read from Entity

**Files:** Modify `server/src/domain/aggregations.ts`.

- [ ] **Step 1:** Replace the `prisma.card.findMany(...)` calls in `computeTrack` and `dashboardSnapshot` with projected pipeline entities (reuse `loadPipelineCards` exported from `cards.service`, or an inline equivalent). The reduce/scope/mask logic is unchanged (operates on Card DTOs). `scopeCardsFor` keeps working on the projected cards.
- [ ] **Step 2:** `npm run test:api -- features overview-preview` (dashboard parity green).
- [ ] **Step 3:** Commit `"Phase 1b: aggregations read from Entity"`.

---

### Task 5: fleet /vehicles + /portal read reference entities

**Files:** Modify `server/src/routes/fleet.ts`; reuse `entityToVehicleDTO`.

- [ ] **Step 1:** In `/vehicles`, read `prisma.entity.findMany({ where:{ entityType:{ key:'vehicle' } }, orderBy:{ title:'asc' } })` and map via `entityToVehicleDTO`; keep the `status`/`q` filters on the projected DTOs. In `/portal`, source the vehicle list the same way (operators/invoices/messages unchanged — `FleetOperator`/`Invoice`/`PortalMessage` are not part of this flip).
- [ ] **Step 2:** `npm run test:api -- features` (vehicles + portal tests green).
- [ ] **Step 3:** Commit `"Phase 1b: /vehicles + /portal read reference entities"`.

---

### Task 6: Full-suite gate + live smoke + docs

- [ ] **Step 1:** `npm run test:api` — expect all 48 green.
- [ ] **Step 2:** `npm run test:ui` — expect 7 Playwright journeys green.
- [ ] **Step 3:** Reseed dev DB (`DATABASE_URL=… npx -w server prisma db seed`) and smoke `/cards`, `/aggregations/dashboard`, `/vehicles` with a minted admin token (counts match pre-flip).
- [ ] **Step 4:** Append a "Phase 1b status" note to the design spec (Card/Vehicle now dormant; per-EntityType governance + SQL aggregation + pagination = Phase 2). Commit.

---

## Self-review

**Spec coverage:** §5 (service repoint, screens unchanged via projection) → Tasks 1–5; testing gate (§9) → Task 6. Per-EntityType governance, SQL `GROUP BY`, pagination (§4/§5) explicitly deferred to Phase 2. RLS (§6) = 1c; partitioning = 1d.

**Risk control:** every task is gated by the existing behavioral tests; projection guarantees identical DTO shapes; logic is reused not rewritten. If any task can't go green, stop and leave status — do not push broken code.
