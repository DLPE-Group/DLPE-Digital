# Generic Entity Model — Design Spec

**Date:** 2026-06-01
**Status:** Approved (brainstorming) — pending user review before plan
**Topic:** Replace the hard-coded `Card` + `Vehicle` + `Track` enum with a single
data-driven entity meta-model: data-driven tracks, data-driven entity types and
fields, a no-code admin authoring UI, full migration of existing data, and a
tenant-aware + RLS foundation that scales to millions of reference entities.

---

## 1. Goal

Make the pipeline/item model fully generic and configurable **without code
changes**:

1. **Data-driven tracks** — add a pipeline (e.g. "Insurance", "Compliance") as
   data, no migration.
2. **Data-driven item types + fields** — define new item kinds with their own
   field schemas as data.
3. **Unify Vehicle into the item model** — one model + one RBAC path for
   everything; per-type a flag decides whether it has a pipeline/stages.
4. **No-code admin UI from the start** — admins author tracks/types/fields in the
   product.
5. **Migrate all existing data** — convert today's cards + vehicles so there is
   real data and the existing screens barely change.

Non-goal for this refactor: the multi-tenant **control plane** (provisioning,
billing, tenant-admin UI). See §6 — foundation now, provisioning later.

---

## 2. Current state (touchpoint inventory)

The model is hard-coded in three places:

- **`Track` enum** (`SALES|OPERATIONS|WORKSHOP|FINANCE`) — `schema.prisma`,
  used by `Card.track`, `StageConfig.track`, `aggregations`, `audit.track`
  (string), and the frontend `tracks` array.
- **`Card` table** — one polymorphic row per pipeline item. RBAC-governed via a
  hard-coded `CARD_FIELD_MAP` (`applyCardRules.ts`) that maps *every* card's
  `value/customer/owner` to the `contract` data type — i.e. all cards are treated
  as contracts for field rules.
- **`Vehicle` table** (+ `VehicleTimeline`/`TimelineEvent`) — separate fleet
  master-data, referenced by `Card.vehicle` (a plate string), powering the
  Vehicles view + customer portal.

Field schemas for RBAC live in `packages/shared/dataTypes.ts` as the hard-coded
`DATA_TYPES` (contract, vehicle, fleet_operator, invoice, workshop_order) +
`FIELD_CATEGORIES` + `SAMPLE_RECORDS`. Stages live in `packages/shared/stages.ts`
(`STAGE_CONFIG`, mirrored to the admin-editable `StageConfig` table; loader
prefers DB). Cross-track cascades live in the `CrossTrigger` table.

Key server consumers: `cards.service.ts` (list/get/move/patch, track-access,
scope, field RBAC, auto-escalate), `aggregations.ts` (`computeTrack`,
`dashboardSnapshot` — **load all cards, reduce in JS**), `scope.ts`
(`visibleCompanyIds` — **loads all, filters in JS**), `applyCardRules.ts`
(`CARD_FIELD_MAP`, `filterCard`, `valueRestricted`), `actions.ts` +
`triggers.engine.ts` (Brussels cascade, deterministic ids `o1`/`f1`),
`audit.service.ts`. Routes: `cards`, `aggregations`, `fleet`
(`/vehicles`, `/portal`), `records` (RBAC preview from `SAMPLE_RECORDS`),
`fieldRules`, `stageConfig`.

Frontend shapes that must keep working: `tracks.jsx` ItemCard
(`{id,type,customer,value,vehicle,sub,stageId,stageName,days,daysLabel,owner,status,cta,sources}`),
`header_tiles.jsx` scorecards, `dashboard.jsx` metrics
(`/aggregations/dashboard` → `{metrics, asOf, restricted, defaultCharts}`),
`portal.jsx` (`{operator,contact,vehicles,invoices,messages}`), `timeline.jsx`
(`{customer,vehicle,contractValue,account,events[]}`), `admin_rbac.jsx`
(consumes `DATA_TYPES`/`SAMPLE_RECORDS`), `editors.jsx` (`StageConfigEditor`,
`CrossTrackTriggerEditor`).

Seed: 18 cards (sales `s1–s5`, ops `o2–o7`, workshop `w1–w4`, finance `f2–f4`;
`o1`/`f1` created only by triggers), the portal fleet + a Brussels timeline,
per-role field-rule diffs, org tree (group→region→country→company), 11 roles.

---

## 3. Target data model

Four data-driven tables replace the enum + two hard-coded tables. **Hybrid
storage** (common scalar columns + a JSON `fields` blob), never pure-EAV.

```
TrackDef                       the boards (data, not enum)
  id, key, label, color, icon, order, builtin: bool
  └─ StageDef[]                ordered stages (today's StageConfig, by trackId)
       id, trackId, order, stageId, label, sla, lock, cta

EntityType                     the "kind of thing" (subsumes DATA_TYPES)
  id, key, label, kind: 'pipeline' | 'reference',
  trackId?                     pipeline types only — default board
  icon, color, order, builtin: bool
  └─ FieldDef[]                schema → drives RBAC matrix + forms + projection
       id, entityTypeId, key, label, category,
       dataKind: text|money|date|select|number|bool, order, builtin: bool

Entity                         ONE table replacing Card + Vehicle
  id, tenantId, entityTypeId, companyId,            -- envelope (indexed)
  title, value, owner, status, sub, sources[],      -- shared display columns
  fields: JSON,                                     -- type-specific values
  archived: bool default false,                     -- hot/cold separation
  -- pipeline-kind only (null for reference):
  trackId, stageId, stageName, days, daysLabel, cta, awaitingSign,
  createdById, createdAt, updatedAt

FieldRule                      unchanged shape; dataTypeId → FK EntityType.key
RbacVersion, CrossTrigger      unchanged (CrossTrigger now references trackId/key)
VehicleTimeline, TimelineEvent unchanged (portal artifact)
```

**Design calls:**

- **Hybrid, not pure-EAV.** Columns every view/aggregate/scope query needs
  (`tenantId`, `companyId`, `entityTypeId`, `trackId`, `stageId`, `status`,
  `value`, `title`, `archived`) are real, indexed columns. Only type-specific
  values (plate, vin, vat, renewal_date…) live in `fields` JSON. Hot queries
  never filter/sort on JSON.
- **`kind` on the EntityType** — each type independently decides if it has a
  pipeline. `pipeline` → has `trackId` + stages + CTA; `reference` → none.
  Vehicle becomes `kind: reference`.
- **Per-EntityType field governance** replaces the hard-coded `CARD_FIELD_MAP`.
  Each entity is RBAC-governed by *its own* type's `FieldDef`s, so hiding a field
  on Invoices vs Contracts vs Vehicles is finally independent. Existing
  `FieldRule` rows keep working because their `dataTypeId`/`fieldId` already match
  the entity-type/field keys.

---

## 4. Performance & scale (hard rules)

Generic-model slowness comes from filtering/sorting on dynamic fields. The
following are **requirements**, not suggestions:

1. **Hot queries only touch real columns** — never `WHERE`/`ORDER BY` on `fields`
   JSON. JSON is read only when projecting a row for display.
2. **Push work into Postgres.** Replace the current in-memory patterns:
   - `listCards`/`scopeCardsFor`: JS `.filter()` → `WHERE trackId IN (…) AND
     companyId IN (…) AND tenantId = … AND archived = false`.
   - `dashboardSnapshot`/`computeTrack`: load-all + `reduce()` →
     `GROUP BY trackId, stageId → sum(value)` / counts (returns a few rows).
   - badge/sidebar counts: `count(*)` or maintained counters, not fetch-all.
   - lists: cursor pagination + per-stage top-N, never the whole table.
3. **Indexes matched to access patterns:** composite B-tree
   `(tenantId, companyId, entityTypeId, trackId, stageId)` and
   `(tenantId, trackId, stageId, status)`; partial indexes `WHERE archived =
   false`.
4. **Escape hatch for dynamic-field queries:** GIN index on `fields` JSONB, or an
   expression index on one key (`((fields->>'plate'))`), or promote a hot field
   to a real column — no redesign needed.
5. **RBAC cost is per-page:** effective rules resolved once per request; masking
   applied only to the returned page.

**Scaling reference entities (millions of vehicles over years):**

- Reference entities accumulate; pipeline items churn (close → cold). The vehicle
  table is the one that hits millions.
- **Partition `Entity` declaratively by `entityTypeId`** (and/or `tenantId`) so a
  pipeline query never scans vehicle rows (partition pruning).
- **Hot/cold:** `archived` flag (or cold partition) for sold/off-fleet vehicles +
  closed deals; default views query the active set via partial indexes.
- **Estimated counts** for huge tables.
- Ceiling check: with partitioning + scope + indexes, Postgres handles tens of
  millions/table comfortably. Sharding/other stores only matter at hundreds of
  millions+ — out of range here.

---

## 5. Compatibility: keep the screens unchanged

A **projection layer** keeps every existing API response byte-identical, so the
frontend barely changes.

```
Entity(entityTypeId=contract, trackId=sales, fields:{…})
   │ project
   ▼
{ id, track:'sales', type:'RENEWAL', customer, value, vehicle, sub,
  stageId, stageName, days, daysLabel, owner, status, cta, sources }   ← today's Card DTO
```

- `GET /cards`, `/cards/:id`, `/aggregations/*` → project **pipeline** entities
  into the current Card DTO. `tracks.jsx`, `header_tiles.jsx`, `dashboard.jsx`
  unchanged.
- `GET /vehicles`, `/portal` → project **reference** entities into today's
  vehicle/portal shapes. `portal.jsx`, Vehicles view unchanged.
- `VehicleTimeline` untouched.

The shim is retained through Phase 3 and only retired (optionally) in Phase 4.

---

## 6. Tenancy & compliance (foundation now, provisioning later)

**Shared-DB can be compliant** (GDPR/ISO 27001/SOC 2) — compliance is about
controls, not physical isolation. Required controls for shared-DB: hard logical
isolation (Postgres **Row-Level Security**), data residency, encryption at
rest/in transit, audit logging (present), RBAC (present), per-tenant export +
erasure. Physical isolation (own DB) is a contractual/trust guarantee big clients
often demand — not a strict legal requirement.

**One codebase serves both modes — "tenant-aware everywhere":**

- **Tenant = top-level org Group.** Every `Entity` carries a denormalized
  `tenantId` (+ `companyId`). All scoping leads with it.
- **RLS on in every deployment** (`tenant_id = current_setting('app.tenant')`).
  Single-tenant DB = exactly one tenant → RLS trivially satisfied → same code.
- **Partitioning** by `tenantId` and/or `entityTypeId`.
- Smaller clients → shared DB isolated by RLS + scope. Big clients → own
  deployment, identical code.

**IN SCOPE for this refactor:** `tenantId` column, RLS policies,
partition-readiness, tenant/company-scoped SQL queries.
**OUT OF SCOPE (separate future project):** client signup/provisioning, per-tenant
billing, tenant-management admin UI. *(Recorded in project memory:
`tenancy-rls-decision` — must not be forgotten.)*

---

## 7. No-code admin UI

A new **group-admin-only** "Data model" section (gated by the existing
`requireAdmin`; group-admin only):

- **Tracks** — list/create/rename/reorder/recolor boards; edit each track's
  stages (label, SLA, lock, CTA). Reuses the existing `StageConfigEditor`,
  re-pointed at `TrackDef`/`StageDef`.
- **Entity types** — create/edit: set `kind` (pipeline → pick track; reference),
  icon, color. Lets an admin add "Insurance claim" (pipeline) or "Driver"
  (reference) with no code.
- **Fields** — per type, add/edit/reorder fields (key, label, category,
  dataKind). These rows drive the RBAC matrix, entity forms, and projection.
  Today's hard-coded `DATA_TYPES` becomes these rows.
- **RBAC configurator** (`admin_rbac.jsx`) reads `EntityType`/`FieldDef` from the
  API instead of the `DATA_TYPES` constant. Matrix UI unchanged.

**Guardrails:** `builtin` types/tracks/fields are editable but not deletable;
field `key` is immutable once data exists (label is freely renamable); deleting a
field referenced by rules warns first.

---

## 8. Phasing

Each phase ends with the app fully working + green tests.

| Phase | Ships | Safety |
|---|---|---|
| **1. Schema + migration + shim** | New tables (`TrackDef`, `EntityType`, `FieldDef`, `Entity` with `tenantId`), RLS policies, partition-ready; migrate 18 cards + vehicles; projection layer → every existing API returns identical shapes. No UI change. | 42 existing tests + new projection-parity tests prove byte-identical responses |
| **2. Services on new model** | `cards.service`, `aggregations` (SQL `GROUP BY`), `scope` (SQL `WHERE`), vehicles/portal read entities; per-EntityType RBAC replaces `CARD_FIELD_MAP`; pagination | §4 scale rules enforced; RBAC/scope tests extended |
| **3. No-code admin UI** | Data-model authoring (tracks/types/fields); RBAC + stage editors read DB schema | create-a-type/track e2e tests |
| **4. Cleanup** | Drop old `Card`/`Vehicle` + `Track` enum once everything reads `Entity`; optionally retire shim | full suite green |

Each phase is a candidate for its own implementation plan (Phase 1 is the largest
and most foundational).

---

## 9. Testing strategy

- **Projection parity (Phase 1, gating):** assert `/cards`, `/cards/:id`,
  `/vehicles`, `/portal`, `/aggregations/dashboard` return the same counts/values
  as before the migration. No API response may change.
- **Per-layer:** extend existing RBAC field-rule, track-access, scope, stage-
  config, admin-access, and preview-as tests to the entity model.
- **Authoring (Phase 3):** Playwright journeys — create a track, define a type,
  add a field, see it appear in the RBAC matrix + a form.
- **Performance:** a benchmark test that seeds ~200k entities and asserts list +
  aggregate queries stay indexed (no sequential scans via `EXPLAIN`), and that a
  tenant-scoped query touches only its partition.

---

## 10. Risks

- **Regression in RBAC/scope** (just hardened in Packages H + admin-restriction).
  Mitigated by projection-parity tests and per-layer test extension.
- **Migration correctness** for the Brussels cascade ids (`o1`/`f1`) and trigger
  determinism — covered by existing actions/audit tests.
- **RLS misconfiguration** locking out legitimate access — single-tenant default
  (one tenant) keeps this low-risk; tested with a cross-tenant isolation test.
- **Scope creep into provisioning** — explicitly fenced off (§6).

---

## Phase 1a status (implemented)

The parallel entity model is live and backfilled; projection parity is proven by
`tests/api/projection-parity.test.mjs` (48 API tests green). No live read path
changed yet. Shipped: `TrackDef`/`StageDef`/`EntityType`/`FieldDef`/`Entity`
tables (additive migration `20260601192848_entity_model_foundation`), a
convergent backfill (`server/src/domain/backfill.ts`) derived from existing
cards/vehicles incl. denormalized `tenantId` (`server/src/domain/tenancy.ts`),
and projection functions (`server/src/domain/projection.ts`).

**Deferred to follow-on plans (do not forget):**
- **1b** — repoint `cards.service`/`aggregations`/`scope`/`fleet` to read from
  `Entity` via the projection; replace `CARD_FIELD_MAP` with per-EntityType
  governance; SQL `GROUP BY` aggregation + scope `WHERE`; pagination. *(First
  phase that changes live behavior — confirm before flipping reads.)*
- **1c** — Row-Level Security: `app.tenant` GUC set per request inside a
  transaction, RLS policies on `Entity`. (See project memory
  `tenancy-rls-decision`. Architectural choice — review approach first.)
- **1d** — physical partitioning of `Entity` by `entityTypeId`/`tenantId` (raw
  SQL migration), applied when volume warrants.

---

## Phase 1b status (implemented)

`Entity` is now the **single source of truth** for pipeline + reference items.
All live read/write paths operate on it, projecting to the legacy DTOs at the
boundary, so the frontend is unchanged. `Card`/`Vehicle` tables are **dormant**
(no longer read or written).

Flipped: `cards.service` (list/get/move/patch), `actions` + `triggers` (writes +
Brussels cascade), `audit.service` (revert), `aggregations` (computeTrack +
dashboard), `search`, `notifications`, and `fleet` (`/vehicles`, `/portal`).
Existing RBAC (`filterCard`/`CARD_FIELD_MAP`), scope (`visibleCompanyIds`), and
auto-escalate logic are reused unchanged on projected DTOs. **48 API + 7 UI tests
green; live smoke confirms reads serve from `Entity`.**

**Still deferred:** SQL `GROUP BY` aggregation, pagination → Phase 2 (perf, when
volume warrants). RLS → 1c. Partitioning → 1d. `Card`/`Vehicle` table drop →
Phase 4 cleanup.

---

## Phase 2 status (per-type governance — implemented)

Per-EntityType field governance is live (decision: per-type, **aggregates
follow**). The hard-coded `CARD_FIELD_MAP` is replaced by per-type field maps
(`contract`→contract_value/customer_name/sales_rep, `invoice`→amount/counterparty,
`workshop_order`→labor_cost), derived from the card's track in
`rbac/applyCardRules.ts`. Hiding a field masks only that type's cards and drops
them from the matching dashboard totals (`aggregations.ts` gates Sales money by
`contract`, Finance money by `invoice`). +3 tests; 54 API green.

Read-only **Data model** admin view (Phase 3a) ships the no-code area's first
slice. **Remaining:** SQL aggregation + pagination (perf), no-code authoring
create/edit (Phase 3b), RLS (1c), partitioning (1d), Card/Vehicle drop (Phase 4).

---

## Phase 3b status (no-code authoring — implemented)

The **Data model** admin area is now read/write. Backend: `POST/PATCH` tracks +
types, `POST/DELETE` fields under `/admin/data-model/*` (group-admin only) with
guardrails — key format, uniqueness (409), pipeline types require a track,
built-in fields can't be deleted. Frontend: New track / New entity type forms +
per-type Add field and field delete, with inline errors. +6 API tests, +1 UI
assertion; **60 API + 8 UI green**; live create→verify→cleanup smoke passed.

**Remaining (all optional / infra):** SQL `GROUP BY` aggregation + pagination
(perf, when volume warrants), RLS (1c — needs non-superuser role decision),
partitioning (1d).

---

## Phase 4 status (legacy tables retired — implemented)

`Card` and `Vehicle` are gone. The seed writes `Entity` directly
(`seedMetaModel` + `cardToEntityCreate`/`vehicleToEntityCreate`, idempotent with
deterministic vehicle ids — fixing a duplicate-entity leak the old backfill had
on reseed); the backfill-from-DB shim is removed. The `Card`/`Vehicle` Prisma
models + tables are dropped (hand-authored migration `20260602100000_drop_card_vehicle`
applied via `migrate deploy`, since `migrate dev` refuses destructive changes
non-interactively). The domain code now types pipeline rows with the shared
`CardDTO` (aliased as `Card`) instead of the Prisma model. **60 API + 8 UI green;
`Entity` is the sole data model.**

**Truly remaining (optional/infra):** SQL `GROUP BY` aggregation + pagination,
RLS (1c), partitioning (1d). Also a noted **follow-up**: stage config has two
sources — the live runtime reads the `StageConfig` table while the Data-model UI
edits `StageDef`; these should be unified to `StageDef` in a small future pass.
