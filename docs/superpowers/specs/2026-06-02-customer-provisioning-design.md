# Customer Provisioning — Foundation + Engine (slice 0+1)

> **STATUS: APPROVED 2026-06-18.** Overall shape and all three flagged judgment calls
> confirmed by the user. This is subsystems **S0 + S1** of the SaaS roadmap
> (`2026-06-18-saas-platform-roadmap.md`) and the first concrete build. Next step:
> writing-plans → implementation plan.
>
> **Judgment calls — all CONFIRMED:**
> 1. `CountryDefaults` stays **global** (shared reference data, not tenant-scoped). ✅
> 2. New **platform-admin tier** above tenant RBAC, for platform operations. ✅
> 3. Refactor `server/prisma/seed.ts` into the first `PUBLISHED` blueprint (`dlpe-demo`);
>    `db:seed` becomes `provisionTenant(demoBlueprint, demoInputs, sharedTarget)`. ✅

## Context

DLPE Digital = Vite+React app / Express+Prisma+Postgres API / shared contracts monorepo.
This spec revisits the multi-tenant **provisioning** work that
[tenancy-rls-decision] deliberately deferred ("Revisit provisioning as its own spec").

Codebase state found during brainstorming:
- Generic entity model has landed (`Entity`, `EntityType`, `FieldDef`, `TrackDef`,
  `StageDef` in `server/prisma/schema.prisma`); `Entity` already carries `tenantId` +
  composite indexes leading with it.
- Tenancy is **partial**: `tenantId` is nullable, there is **no `Tenant` table**, no RLS
  migration, and the older models (`OrgNode`, `User`, `Role`, `FieldRule`, `StageConfig`,
  `CrossTrigger`, …) carry no tenant scope.
- A customer's "shape" today = OrgNode tree + Roles/FieldRules + StageConfig/TrackDef/
  StageDef + EntityTypes/FieldDefs + seed Entities + Users — all hand-built in the 42KB
  `server/prisma/seed.ts`. **That hardcoded seed is effectively a customer template.**

## The bigger vision (decomposed — this spec is only 0+1)

The user wants to "launch a new customer in minutes," for single- and multi-tenant, with
template/clone-from-previous, a guided wizard, and a self-serve motion. That is **5
independently-buildable subsystems**, each getting its own spec later:

| # | Subsystem | Depends on |
|---|-----------|-----------|
| **0** | **Tenant foundation** — `Tenant` table, `tenantId` non-null + threaded, RLS | — |
| **1** | **Provisioning engine** — blueprint-driven, transactional, idempotent | 0 |
| 2 | Blueprints/templates — capture a live customer as a reusable template | 1 |
| 3 | Guided setup wizard — internal admin step-by-step UX | 1, 2 |
| 4 | Control plane — admin area to list/create/suspend customers | 1 |
| 5 | Self-serve motion — public configurator + trial sandbox + signup→paid | 1, 4 |

**Other "new customer" areas surfaced as future blueprint dimensions / wizard steps:**
per-customer branding/theming, default integrations (Nango seam), data import/migration,
custom domain + SSO/OIDC (AuthProvider seam), data-residency choice, subscription tier /
feature flags, trial→production promotion, default dashboards & report templates, welcome
email setup.

## Decisions captured (from brainstorming Q&A)

- **Primary tenancy motion:** user first said "both modes equally," then — once the infra
  cost was clear — narrowed THIS spec to **shared-DB only**, with the target *interface*
  designed so dedicated-deployment slots in later without a rewrite.
- **Self-serve goal (subsystem 5, later):** full self-serve **signup → paid** (will need
  billing, tiers, abuse protection, email verification — out of scope here, but the engine
  must not preclude it).
- **Spec first:** Foundation + Provisioning engine (**0+1**). Others get their own specs.
- **Blueprint storage:** **DB-backed, JSON export/import.** Clone-from-previous =
  snapshot a live tenant's config into a Blueprint row.
- **Engine architecture: Approach A — declarative blueprint + interpreter** (chosen over
  imperative-code blueprints, which would kill clone + self-serve; and over hybrid
  code-hooks, deferred as the growth path).

## Design

### 1. Tenant foundation
- New **`Tenant`** table: `id, slug (unique, subdomain-safe), name, status
  (TRIAL|ACTIVE|SUSPENDED|ARCHIVED), tenancyMode (SHARED now; DEDICATED reserved),
  region, settings JSON, createdAt`. A tenant's org root is its top-level `GROUP` `OrgNode`.
- Add non-null **`tenantId`** (FK→Tenant) to every tenant-scoped model: OrgNode, User,
  Role, FieldRule, RbacVersion, StageConfig, CrossTrigger, TrackDef, StageDef, EntityType,
  FieldDef, Entity, Session, UserScope, Report, AuditEntry, AuditCascade, DashboardLayout,
  DataSharing, UserPreference, PortalMessage, Integration, FleetOperator, Invoice,
  VehicleTimeline, TimelineEvent.
- **Judgment call:** `CountryDefaults` stays **global** (shared reference data, not
  tenant-scoped). — needs user sign-off.
- **Migration:** create one "DLPE demo" tenant, backfill existing rows to it, THEN flip
  `tenantId` to NOT NULL. No data loss.
- **RLS:** enable on every tenant-scoped table; policy
  `tenant_id = current_setting('app.tenant_id')`. Two Postgres roles — `app_user`
  (RLS-enforced, serves requests) and `app_owner` (BYPASSRLS, used only by the
  provisioning engine + platform control-plane). A `withTenant(tenantId, fn)` helper sets
  `SET LOCAL app.tenant_id` inside a transaction; request middleware resolves tenant from
  the authed user's `tenantId` and wraps the request.

### 2. Blueprint store
- **`Blueprint`** table: `id, key, name, version, status (DRAFT|PUBLISHED|ARCHIVED),
  spec JSON, sourceTenantId?, description, createdAt/By`.
- **`spec`** = declarative document (Zod schema, `specVersion` for forward-compat):
  `inputs[]` (typed params the wizard/self-serve collect — customerName, companies,
  adminEmail, locale, currency, region…), `orgStructure`, `roles`+`fieldRules`,
  `tracks`+`stages`+`stageConfig`, `crossTriggers`, `entityTypes`+`fieldDefs`,
  `seed` (toggleable demo entities), `branding`, `integrations` (disabled placeholders),
  `adminUser`.
- **Export/import:** Blueprint row ⇄ JSON file. **Capture** (`captureBlueprint(tenantId)`)
  reads a live tenant's *config* (not business rows) into a new Blueprint — this makes
  "clone from a previous setup" real, so it's in scope here.

### 3. Provisioning engine
- **`provisionTenant({ blueprint, inputs, target })`:** validate `inputs` against the
  blueprint's declared input schema → `target.prepare()` (shared-DB: create Tenant row,
  enter tenant context) → in **one transaction**: org tree → roles/field-rules →
  tracks/stages/config → cross-triggers → entity-types/field-defs → optional seed entities
  → admin user (argon2 hash or invite token). Atomic; partial failure rolls back.
- **Idempotency:** a `ProvisioningRun` record (status, steps, error, idempotencyKey);
  slug collisions + re-runs handled. Returns `{ tenantId, slug, adminLoginOrInviteLink }`.
- **`ProvisioningTarget` interface:** `SharedDbTarget` fully implemented;
  `DedicatedDeploymentTarget` declared but throws "deferred to future spec" — the seam
  that honors "both modes later."
- **Judgment call — platform-admin tier (new):** provisioning is a *platform* operation
  ABOVE tenant RBAC. Introduce a platform-admin flag/role; the demo `r.mertens`
  group-admin is a *tenant* admin, distinct from this. Minimal API now (full control plane
  = subsystem 4): `POST /api/platform/tenants`, `GET .../tenants`, `GET/POST
  .../blueprints`, blueprint export/import. — needs user sign-off.

### 4. Dogfood — retire the hardcoded seed
- **Judgment call:** refactor `server/prisma/seed.ts` into the first `PUBLISHED` blueprint
  (`dlpe-demo`). `db:seed` becomes
  `provisionTenant(demoBlueprint, demoInputs, sharedTarget)`. The demo becomes "just
  another customer provisioned from a blueprint" — also the engine's best integration
  test. — needs user sign-off.

### 5. Testing
- Provision the demo blueprint into a clean test DB → assert every row exists + is
  tenant-scoped.
- **RLS isolation test:** as tenant A, a crafted query CANNOT read tenant B's entities.
- Idempotency: re-running a provision produces no duplicates.
- Validation: bad `inputs` return structured per-field errors (feeds the future wizard).

## Resolved (2026-06-18)
All three judgment calls confirmed (see header) and the overall shape approved. Spec
self-review passed. Proceeding to the implementation plan via the writing-plans skill.
