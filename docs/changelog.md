# Changelog

Auto-generated from git history (newest first). Refreshed on every commit by the `.githooks/pre-commit` hook; merge commits are omitted.


## 2026-06-23

- `bb239b9` fix(rls): NO FORCE so managed-Postgres (non-superuser owner) can provision

## 2026-06-22

- `8272448` fix(provisioning): clean-customer onboarding template + namespace seed ids
- `f721c01` docs: drop stray boot-guard plan from generated index
- `2975f70` docs: MkDocs site + auto-generating pre-commit hook
- `7b7ac14` Local production-parity Docker stack (1:1 with DigitalOcean)
- `b746c7c` tenant-iso: production boot guard — fail fast if APP_DATABASE_URL missing or RLS-bypassing
- `8099de8` tenant-iso Task 7: leak sweep + APP_DATABASE_URL deploy rule + final isolation proof
- `9c0d344` tenant-iso Task 6 fix: close cards actions + loadStages RLS bypass
- `222f4cf` tenant-iso Task 6: domain/entity family (fleet/portal/cards/records) through withTenant
- `b7c41e1` tenant-iso Task 5: reporting + me family (reports/audit/dashboard/permissions/preferences) through withTenant
- `119962c` tenant-iso Task 4: integrations + triggers through withTenant
- `744ae43` tenant-iso Task 3 fix: drop as-any cast in PATCH field handler (typed discriminated union)
- `4a41e5d` tenant-iso Task 3: config family (data-model/structure/stage-config) through withTenant
- `28deee5` tenant-iso Task 2: RBAC family (users/roles/field-rules/rbac) through withTenant
- `b9e9683` tenant-iso Task 1: il_app test wiring, tenant-portable requireAdmin, isolation harness + users/roles list
- `ede5622` tenant-iso plan: runtime isolation enforcement (7 route families)
- `699384a` S-ISO design: runtime tenant isolation enforcement (activate RLS on all request routes)

## 2026-06-19

- `d92a771` S4 final-review fixes: preflight validates admin.email; drop dead style
- `9c2eaef` S4 Task 5: mount wizard in control plane + e2e journey
- `abceb64` S4 Task 4: guided provisioning wizard component
- `13002d9` S4 Task 3: provision preflight route (dry-run validation + summary)
- `1c6ae9a` S4 Task 2 fix: scope to overrides only; test via config-only captured blueprint
- `c2e8a67` S4 Task 2: provision overrides (admin name/email + planKey)
- `1a0e96b` S4 Task 1: extract provisioning derive helpers (slugify/validate/resolve/summarize)
- `2ff1925` S4 plan: guided setup wizard (5 tasks)
- `00d46be` S4 design: guided setup wizard (preflight + provision overrides)
- `0762e05` test(blueprints): control-plane capture journey + final verify
- `90cf3f0` fix(admin_platform): cross-browser export anchor + SectionHead count guard
- `a111a35` feat(blueprints): control-plane blueprint management (capture/publish/archive/export/import)
- `522f1a2` test(blueprints): capture->provision round-trip
- `724b46e` feat(blueprints): capture-from-tenant + blueprint lifecycle (publish/archive)
- `1bde1bb` docs: S2 blueprints/templates spec + plan (capture-from-tenant, lifecycle, UI)
- `458c8d9` feat(billing): control-plane plan column + change-plan; journey + verify
- `ca9bf97` test(billing): add afterAll to unconditionally restore demo subscription to enterprise/ACTIVE
- `d5cdc68` feat(billing): platform API — list plans, read/change tenant subscription
- `aafad30` feat(billing): enforce plan maxUsers on tenant user creation (402)
- `1fca099` feat(billing): provisionTenant assigns default-plan subscription (TRIALING)
- `7c733d5` feat(billing): entitlement helpers (features/limits/active)
- `200bf65` feat(billing): BillingProvider seam (Simulated impl, Stripe stub)
- `0eab871` feat(billing): Plan + Subscription models (RLS), seed plans + demo subscription
- `9d67d2d` docs: S6 billing spec + plan (thin, pluggable, simulated provider)

## 2026-06-18

- `81f1452` fix(tests): remove order-dependent platformAdmin mutation in platform-api tests
- `7d19396` test(ui): Playwright journey for Control Plane — suspend/reactivate demo tenant
- `a852acb` fix(control-plane): provision form — submittable without slug/customerName, input type passthrough, reset after provision
- `5f4484a` feat(control-plane): provision-new-customer form (blueprint + dynamic inputs)
- `cc35bb4` feat(control-plane): platform-admin Control Plane view (tenants + blueprints + suspend)
- `6688223` fix: narrow PATCH /tenants/:id catch to Prisma P2025 not-found only
- `589cc83` feat(control-plane): platformAdmin on /me, PATCH tenant status, demo platform admin
- `11bc69a` docs: S3 control-plane spec + implementation plan (4 tasks)
- `a7f2b6f` fix(provisioning): move hardcoded Düsseldorf FleetOperator into blueprint seed payload
- `6e3a5a2` feat(provisioning): dogfood seed via dlpe-demo blueprint + provisionTenant
- `eb08004` feat(provisioning): platform-admin tier + minimal /api/platform API
- `c18687d` feat(provisioning): captureBlueprint reads a live tenant config into a BlueprintSpec
- `4a47b7f` fix(provisioning): harden idempotency — upsert run record, persist invite link, add retry test
- `a9e6a51` feat(provisioning): idempotent re-runs via ProvisioningRun key
- `0be3638` fix(provisioning): Zod default override + argon2 hoist out of tx
- `6c6a89f` fix(provisioning): id-mode, multi-user seed, invite status, StageConfig skip-dupes, comment
- `540343b` feat(provisioning): provisionTenant interpreter (atomic, input-validated)
- `f607eeb` feat(provisioning): ProvisioningTarget interface + SharedDbTarget (dedicated stubbed)
- `28dbfaf` feat(provisioning): BlueprintSpec Zod schema (specVersion 1)
- `aff5128` feat(provisioning): Blueprint + ProvisioningRun tables + User.platformAdmin
- `42779c6` docs: S1 provisioning-engine implementation plan (8 tasks, TDD)
- `e845505` fix(tenant-isolation): thread req.tenantId through card write paths
- `a2ba5de` test(rls): make cross-tenant isolation test self-contained using il_app client
- `4bce3a0` feat(s0): wire tenant into request pipeline; remove DEMO_TENANT_ID from all request paths
- `56f3cd4` feat(tenant): enable RLS + cross-tenant isolation policies on all 26 scoped tables
- `c4c6aa8` feat(tenant): withTenant transaction helper + tenant-context middleware
- `f6419b9` feat(tenant): add non-superuser il_app role + APP_DATABASE_URL
- `ded6151` feat(tenant): expose tenantId on the authenticated principal
- `5c1bd43` Review fixes (I2/I1/M1): import DEMO_TENANT_ID from tenancy.ts, update stale comment, fix migration re-run claim
- `f65cc1a` feat(tenant): backfill demo tenant + set tenantId NOT NULL (contract)
- `4396529` feat(tenant): add Tenant model + nullable tenantId on all scoped models (expand)
- `a231a78` docs: S0 tenant-isolation implementation plan (7 tasks, TDD)
- `b2f8db9` docs: approve S0+S1 provisioning spec (judgment calls confirmed)
- `bb98b51` docs: SaaS platform roadmap & subsystem decomposition
- `cbe9416` docs: deployment rules for safe multi-environment releases

## 2026-06-02

- `f1b2284` CRUD UI: trigger edit + structure add-any-kind/delete
- `43d0274` CRUD UI: roles (rename/delete), users (deactivate), integrations (remove), records (new item + delete)
- `6209e0a` CRUD completion (backend): roles, users, structure, integrations, triggers, records
- `1835f99` Data model CRUD UI: edit/delete tracks, types, fields
- `c5aa1e7` Data model CRUD: PATCH field + DELETE type/track (guarded)
- `6ea8431` Phase 4: document legacy-table retirement + stage-config follow-up
- `3941d41` Phase 4: retire the legacy Card/Vehicle tables
- `2b78963` Phase 3b: document no-code authoring completion
- `8c8baa2` Phase 3b: no-code authoring UI (create tracks/types, add/remove fields)
- `d251c5c` Phase 3b: no-code authoring API (create/edit tracks, types, fields)
- `363a436` Phase 2: document per-type governance completion
- `bb9c701` Phase 2: per-EntityType field governance (aggregates follow)

## 2026-06-01

- `d54b706` Phase 3a: read-only Data model admin view (tracks/types/fields)
- `d33fd8c` Phase 3a: read-only data-model API (GET /admin/data-model)
- `2eeef6b` Phase 1c/1d: document RLS + partitioning approach (deferred, needs infra/security decision)
- `13c196b` Phase 1b: document completion (Entity is source of truth; Card/Vehicle dormant)
- `f7e4e41` Phase 1b: /vehicles + /portal read reference entities
- `118894c` Phase 1b: aggregations, search, notifications read from Entity
- `ffc0d59` Phase 1b: actions, triggers, and revert write/cascade on Entity
- `bcd4d9b` Phase 1b: moveStage/patchCard write to Entity
- `3774e73` Phase 1b: listCards/getCard read from Entity (projected)
- `d331dc2` Plan: Phase 1b — services on Entity (read/write flip, projection at boundary)
- `a87543e` Phase 1a: document completion + 1b/1c/1d boundary
- `3a5d42f` Phase 1a: projection-parity tests + convergent backfill
- `37c8c46` Phase 1a: idempotent backfill of entity model from cards/vehicles
- `861abe4` Phase 1a: Entity→Card/Vehicle projection functions
- `ccc4f25` Phase 1a: tenant resolver (group ancestor of a company)
- `80efbc5` Phase 1a: add entity meta-model tables (additive)
- `4b55b41` Plan: Phase 1a — entity model foundation (parallel + projection parity)
- `810da38` Design spec: generic entity meta-model (data-driven tracks/types/fields)
- `879be35` Restrict Administration, Integrations, and Audit to group-admin
- `b21c56c` Gate "Preview as" to admins only (matches server enforcement)
- `5f4e920` Enforce track-access + scope on overview; make preview-as actually work
- `dee9b5f` Package H5: mark data-sharing Advisory (not runtime-enforced) + doc the pass
- `503e693` Package H4: row-level scope filtering by org tree
- `cfc9fd3` Package H3 (frontend): hide disallowed track nav items
- `05abe72` Package H3: enforce role → track access on live data
- `b59514a` Package H2: make stage config DB-driven at runtime
- `5dfe4c2` Package H1: enforce RBAC field rules on LIVE data (not just /records preview)
- `71dbcc3` Add full test harness: Vitest API suite + Playwright UI suite (isolated test DB)
- `da83479` Package G8: auto-escalate stuck items (compute on read)
- `23cc878` Package G7: global search over cards + vehicles
- `fb2ff7b` Package G5: bulk CSV user import
- `45646b9` Package G4: integrations list from API + real Test/Config/Logs
- `3de5cf3` Package G3: in-app notifications bell (derived from live DB)
- `3ef4498` Package G1: enforce stage locks (enforceLocks pref) in moveStage
- `699e0d8` Package G0: add "Simulated" badge to external-dependent features
- `1577c56` Package F: utility buttons made real (+ honest removals)
- `fd0df26` Package E: expose seeded fleet/portal models via API
- `30f3450` Package D: persist user settings preferences
- `5dbc815` Package C: real role create/clone + RBAC version revert
- `1aff6c7` Package B: wire dead admin buttons to existing endpoints
- `b4663b7` Package A: dashboard reads real metrics from API, drop random-tick simulation
- `7980964` Package A: compute dashboard snapshot from live DB cards
- `69e4fa1` Add Swagger UI API docs generated from Zod (dev-only /api/docs)
- `a318b7c` Plan: Package A — dashboard values from the DB
- `a854fce` Design spec: make-everything-real (eliminate mock data & dead actions)
- `f341992` Add START_HERE.md — local quickstart for continuing in VS Code
- `2474672` Phase 3: deployment readiness — prod build, hardening, containerization
- `b3ef940` Wire remaining admin editors + reports/dashboard to API; add audit revert
- `4ea8c75` Phase 2: server-enforced field-level RBAC + preview-as
- `843509e` Phase 1: backend (Express+Prisma+Postgres) + frontend API wiring

## 2026-05-31

- `2d99a48` Add monorepo foundation: workspaces, docker-compose, env template
- `a8c1e03` Implement Intelligence Layer as Vite + React app
- `6fede3e` Claude Design handoff: Dlpe Digital

<small>141 commits.</small>

