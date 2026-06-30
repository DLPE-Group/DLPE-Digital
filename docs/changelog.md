# Changelog

Auto-generated from git history (newest first). Refreshed on every commit by the `.githooks/pre-commit` hook; merge commits are omitted.


## 2026-06-30

- `97774d2` fix(board): render stages from saved config, not hardcoded arrays
- `1294b49` ci: provide required env (DATABASE_URL/JWT/APP_DATABASE_URL/SERVE_STATIC) to test job
- `1fd7852` ci: generate the Prisma client before build/seed/tests
- `a144367` fix(stage-config): reveal the stage delete button (CSS class mismatch)
- `a70ab4b` fix(stage-config): per-tenant stages, no crash on save, block deleting in-use stages

## 2026-06-25

- `7e52df8` fix(ui): neutralize the scripted demo storyline (action flows, audit, AI mapping)
- `5cb0841` fix(admin): purge remaining demo place/role/name fixtures from admin UI
- `3f028be` fix(admin): stop demo fixtures leaking into RBAC / Structure / Users screens
- `c7e999a` fix(admin): tenant admins can actually add users (nav gate + real roles)
- `13f67a3` feat(provisioning): optional admin password in the wizard (first-admin login)
- `79cdd45` feat(provisioning): bootstrap the Plan catalogue too (wizard plan dropdown)
- `78f5122` feat(provisioning): blueprint catalogue bootstrap + seed cross-ref namespacing

## 2026-06-24

- `0efc16f` frontend Task 5: remove demo chrome (How-this-is-wired footer, sources-synced footer, Demo-sign action)
- `cb99033` frontend Task 4: Integrations + Portal render real API data only (drop demo fallbacks)
- `536f976` frontend Task 3: Reports metrics from real /aggregations (drop SEED_* fixtures)
- `1d5ab07` frontend Task 2: Overview snapshot + hero tiles use real counts (no demo numbers)
- `c90775c` frontend Task 1: Vehicles + search + timeline use real /vehicles (no demo fixtures)
- `53866fc` plan: frontend real+generic (wire views to APIs, remove demo fixtures/chrome)
- `1df5d69` fix(tenant): remove DEMO_TENANT_ID request-path fallbacks (FK-safe in prod) + login regression test
- `85f5b4f` fix(auth): stamp refresh Session with the user's tenant, not hardcoded demo

## 2026-06-23

- `c267f5e` docs(deploy): record deferred SPA-on-CDN static-site optimization
- `dfd1b69` ci: test-gated deploy — run suite on push, deploy to DO only on green
- `5d18941` deploy: DigitalOcean App Platform spec + doctl runbook (auto-deploy on push)
- `b34f4fd` feat(deploy): bootstrap-admin command for first platform admin (no demo seed)
- `52b4efb` fix(rls): NO FORCE so managed-Postgres (non-superuser owner) can provision

## 2026-06-22

- `bf68c3a` fix(provisioning): clean-customer onboarding template + namespace seed ids
- `c320320` docs: drop stray boot-guard plan from generated index
- `f0df608` docs: MkDocs site + auto-generating pre-commit hook
- `530b613` Local production-parity Docker stack (1:1 with DigitalOcean)
- `16b2162` tenant-iso: production boot guard — fail fast if APP_DATABASE_URL missing or RLS-bypassing
- `64f82f6` tenant-iso Task 7: leak sweep + APP_DATABASE_URL deploy rule + final isolation proof
- `f839cec` tenant-iso Task 6 fix: close cards actions + loadStages RLS bypass
- `b234975` tenant-iso Task 6: domain/entity family (fleet/portal/cards/records) through withTenant
- `95ae019` tenant-iso Task 5: reporting + me family (reports/audit/dashboard/permissions/preferences) through withTenant
- `89d5729` tenant-iso Task 4: integrations + triggers through withTenant
- `e7a725e` tenant-iso Task 3 fix: drop as-any cast in PATCH field handler (typed discriminated union)
- `e587e18` tenant-iso Task 3: config family (data-model/structure/stage-config) through withTenant
- `feed1de` tenant-iso Task 2: RBAC family (users/roles/field-rules/rbac) through withTenant
- `8da2793` tenant-iso Task 1: il_app test wiring, tenant-portable requireAdmin, isolation harness + users/roles list
- `86cd273` tenant-iso plan: runtime isolation enforcement (7 route families)
- `e704b06` S-ISO design: runtime tenant isolation enforcement (activate RLS on all request routes)

## 2026-06-19

- `1020666` S4 final-review fixes: preflight validates admin.email; drop dead style
- `5801bd1` S4 Task 5: mount wizard in control plane + e2e journey
- `82e94bf` S4 Task 4: guided provisioning wizard component
- `9e09af9` S4 Task 3: provision preflight route (dry-run validation + summary)
- `93632d4` S4 Task 2 fix: scope to overrides only; test via config-only captured blueprint
- `dff035f` S4 Task 2: provision overrides (admin name/email + planKey)
- `d3808dd` S4 Task 1: extract provisioning derive helpers (slugify/validate/resolve/summarize)
- `39d7af9` S4 plan: guided setup wizard (5 tasks)
- `937ad88` S4 design: guided setup wizard (preflight + provision overrides)
- `e24b18e` test(blueprints): control-plane capture journey + final verify
- `8d64bdb` fix(admin_platform): cross-browser export anchor + SectionHead count guard
- `701907b` feat(blueprints): control-plane blueprint management (capture/publish/archive/export/import)
- `b694d74` test(blueprints): capture->provision round-trip
- `ef496ce` feat(blueprints): capture-from-tenant + blueprint lifecycle (publish/archive)
- `fce1349` docs: S2 blueprints/templates spec + plan (capture-from-tenant, lifecycle, UI)
- `348b70d` feat(billing): control-plane plan column + change-plan; journey + verify
- `f7d58f6` test(billing): add afterAll to unconditionally restore demo subscription to enterprise/ACTIVE
- `00cc4bd` feat(billing): platform API — list plans, read/change tenant subscription
- `5fac2ff` feat(billing): enforce plan maxUsers on tenant user creation (402)
- `10e3067` feat(billing): provisionTenant assigns default-plan subscription (TRIALING)
- `fd8d858` feat(billing): entitlement helpers (features/limits/active)
- `83213c3` feat(billing): BillingProvider seam (Simulated impl, Stripe stub)
- `ada79e1` feat(billing): Plan + Subscription models (RLS), seed plans + demo subscription
- `0fbe831` docs: S6 billing spec + plan (thin, pluggable, simulated provider)

## 2026-06-18

- `411543d` fix(tests): remove order-dependent platformAdmin mutation in platform-api tests
- `f180088` test(ui): Playwright journey for Control Plane — suspend/reactivate demo tenant
- `a5d3345` fix(control-plane): provision form — submittable without slug/customerName, input type passthrough, reset after provision
- `6c3e0a3` feat(control-plane): provision-new-customer form (blueprint + dynamic inputs)
- `a3a3b2a` feat(control-plane): platform-admin Control Plane view (tenants + blueprints + suspend)
- `45fadf5` fix: narrow PATCH /tenants/:id catch to Prisma P2025 not-found only
- `5a8cc1e` feat(control-plane): platformAdmin on /me, PATCH tenant status, demo platform admin
- `bb7945f` docs: S3 control-plane spec + implementation plan (4 tasks)
- `7e17a63` fix(provisioning): move hardcoded Düsseldorf FleetOperator into blueprint seed payload
- `9478bef` feat(provisioning): dogfood seed via dlpe-demo blueprint + provisionTenant
- `f247ca2` feat(provisioning): platform-admin tier + minimal /api/platform API
- `71e3e4e` feat(provisioning): captureBlueprint reads a live tenant config into a BlueprintSpec
- `9fe4cf8` fix(provisioning): harden idempotency — upsert run record, persist invite link, add retry test
- `18e4f7a` feat(provisioning): idempotent re-runs via ProvisioningRun key
- `eae9273` fix(provisioning): Zod default override + argon2 hoist out of tx
- `f0970d1` fix(provisioning): id-mode, multi-user seed, invite status, StageConfig skip-dupes, comment
- `5adfa0d` feat(provisioning): provisionTenant interpreter (atomic, input-validated)
- `d3150fb` feat(provisioning): ProvisioningTarget interface + SharedDbTarget (dedicated stubbed)
- `6555066` feat(provisioning): BlueprintSpec Zod schema (specVersion 1)
- `2726862` feat(provisioning): Blueprint + ProvisioningRun tables + User.platformAdmin
- `3e97d42` docs: S1 provisioning-engine implementation plan (8 tasks, TDD)
- `84a7455` fix(tenant-isolation): thread req.tenantId through card write paths
- `06b0a27` test(rls): make cross-tenant isolation test self-contained using il_app client
- `022508d` feat(s0): wire tenant into request pipeline; remove DEMO_TENANT_ID from all request paths
- `96a8392` feat(tenant): enable RLS + cross-tenant isolation policies on all 26 scoped tables
- `59c233a` feat(tenant): withTenant transaction helper + tenant-context middleware
- `8825843` feat(tenant): add non-superuser il_app role + APP_DATABASE_URL
- `644a83a` feat(tenant): expose tenantId on the authenticated principal
- `82ff4fe` Review fixes (I2/I1/M1): import DEMO_TENANT_ID from tenancy.ts, update stale comment, fix migration re-run claim
- `e0f397c` feat(tenant): backfill demo tenant + set tenantId NOT NULL (contract)
- `76c2659` feat(tenant): add Tenant model + nullable tenantId on all scoped models (expand)
- `85649cf` docs: S0 tenant-isolation implementation plan (7 tasks, TDD)
- `7a04be6` docs: approve S0+S1 provisioning spec (judgment calls confirmed)
- `e4e7067` docs: SaaS platform roadmap & subsystem decomposition
- `82b835c` docs: deployment rules for safe multi-environment releases

## 2026-06-02

- `e482251` CRUD UI: trigger edit + structure add-any-kind/delete
- `6e04d60` CRUD UI: roles (rename/delete), users (deactivate), integrations (remove), records (new item + delete)
- `1f91c39` CRUD completion (backend): roles, users, structure, integrations, triggers, records
- `0f3263e` Data model CRUD UI: edit/delete tracks, types, fields
- `ef47af8` Data model CRUD: PATCH field + DELETE type/track (guarded)
- `e6ff84c` Phase 4: document legacy-table retirement + stage-config follow-up
- `7c603ef` Phase 4: retire the legacy Card/Vehicle tables
- `2d1e194` Phase 3b: document no-code authoring completion
- `882a6b0` Phase 3b: no-code authoring UI (create tracks/types, add/remove fields)
- `9bf22f3` Phase 3b: no-code authoring API (create/edit tracks, types, fields)
- `60cdfe6` Phase 2: document per-type governance completion
- `0f7dc90` Phase 2: per-EntityType field governance (aggregates follow)

## 2026-06-01

- `b20df70` Phase 3a: read-only Data model admin view (tracks/types/fields)
- `bd11c3d` Phase 3a: read-only data-model API (GET /admin/data-model)
- `e7e1ff1` Phase 1c/1d: document RLS + partitioning approach (deferred, needs infra/security decision)
- `4ece8b8` Phase 1b: document completion (Entity is source of truth; Card/Vehicle dormant)
- `9df525e` Phase 1b: /vehicles + /portal read reference entities
- `d6c162c` Phase 1b: aggregations, search, notifications read from Entity
- `4abf449` Phase 1b: actions, triggers, and revert write/cascade on Entity
- `02f5d62` Phase 1b: moveStage/patchCard write to Entity
- `dde68ea` Phase 1b: listCards/getCard read from Entity (projected)
- `ff25e59` Plan: Phase 1b — services on Entity (read/write flip, projection at boundary)
- `445c9a2` Phase 1a: document completion + 1b/1c/1d boundary
- `faa8ee5` Phase 1a: projection-parity tests + convergent backfill
- `b35ef27` Phase 1a: idempotent backfill of entity model from cards/vehicles
- `e822533` Phase 1a: Entity→Card/Vehicle projection functions
- `0351d00` Phase 1a: tenant resolver (group ancestor of a company)
- `baff774` Phase 1a: add entity meta-model tables (additive)
- `eecb7ce` Plan: Phase 1a — entity model foundation (parallel + projection parity)
- `5f39559` Design spec: generic entity meta-model (data-driven tracks/types/fields)
- `f65da28` Restrict Administration, Integrations, and Audit to group-admin
- `3994c1b` Gate "Preview as" to admins only (matches server enforcement)
- `cb1a7fa` Enforce track-access + scope on overview; make preview-as actually work
- `4ec852b` Package H5: mark data-sharing Advisory (not runtime-enforced) + doc the pass
- `9cbdcad` Package H4: row-level scope filtering by org tree
- `f8d57ca` Package H3 (frontend): hide disallowed track nav items
- `9d13aa0` Package H3: enforce role → track access on live data
- `d34a539` Package H2: make stage config DB-driven at runtime
- `f8e7aa3` Package H1: enforce RBAC field rules on LIVE data (not just /records preview)
- `a5e5dd4` Add full test harness: Vitest API suite + Playwright UI suite (isolated test DB)
- `c28fff2` Package G8: auto-escalate stuck items (compute on read)
- `4c30c03` Package G7: global search over cards + vehicles
- `10f0f51` Package G5: bulk CSV user import
- `ecf2ebf` Package G4: integrations list from API + real Test/Config/Logs
- `f56b62d` Package G3: in-app notifications bell (derived from live DB)
- `75042e4` Package G1: enforce stage locks (enforceLocks pref) in moveStage
- `c55302a` Package G0: add "Simulated" badge to external-dependent features
- `4368846` Package F: utility buttons made real (+ honest removals)
- `0e5f0e9` Package E: expose seeded fleet/portal models via API
- `9567c3d` Package D: persist user settings preferences
- `a2de7ce` Package C: real role create/clone + RBAC version revert
- `81f2084` Package B: wire dead admin buttons to existing endpoints
- `8518a99` Package A: dashboard reads real metrics from API, drop random-tick simulation
- `2847426` Package A: compute dashboard snapshot from live DB cards
- `1d57e8f` Add Swagger UI API docs generated from Zod (dev-only /api/docs)
- `ef0ea9a` Plan: Package A — dashboard values from the DB
- `a5ed044` Design spec: make-everything-real (eliminate mock data & dead actions)
- `f341992` Add START_HERE.md — local quickstart for continuing in VS Code
- `2474672` Phase 3: deployment readiness — prod build, hardening, containerization
- `b3ef940` Wire remaining admin editors + reports/dashboard to API; add audit revert
- `4ea8c75` Phase 2: server-enforced field-level RBAC + preview-as
- `843509e` Phase 1: backend (Express+Prisma+Postgres) + frontend API wiring

## 2026-05-31

- `2d99a48` Add monorepo foundation: workspaces, docker-compose, env template
- `a8c1e03` Implement Intelligence Layer as Vite + React app
- `6fede3e` Claude Design handoff: Dlpe Digital

<small>165 commits.</small>

