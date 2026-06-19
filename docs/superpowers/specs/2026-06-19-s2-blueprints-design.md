# S2 — Blueprints / Templates — design

> **Status:** design for subsystem **S2** of the SaaS roadmap. Intent approved in the roadmap brainstorm ("capture a live customer as a reusable template; clone-from-previous"). Builds on S1 (`captureBlueprint`, `Blueprint` table, `/api/platform/blueprints*`) + S3 (control plane).

## Goal
Turn provisioning from "provision from the one hardcoded `dlpe-demo` blueprint" into "**capture any live tenant's setup as a reusable template**, manage its lifecycle, and provision new customers from it." Most of the engine already exists (S1's `captureBlueprint` + blueprint CRUD/export/import); S2 wires capture into an API + the control plane and adds blueprint lifecycle (publish/archive).

## Scope
- **Capture-from-tenant:** `POST /api/platform/tenants/:id/capture { key, name }` → runs `captureBlueprint(prisma, tenantId)` (config only, no business rows — already implemented in S1), validates the result against `BlueprintSpec`, and stores a new `Blueprint` row at status `DRAFT` (sourceTenantId = the captured tenant). 409 on duplicate key; 404 unknown tenant; 422 if the captured spec fails validation.
- **Lifecycle:** `PATCH /api/platform/blueprints/:id { status }` — move between `DRAFT | PUBLISHED | ARCHIVED` (validated against the enum). Provisioning prefers `PUBLISHED` blueprints (the provision form already sorts PUBLISHED first; no functional gate change needed here).
- **Export/import:** already exist (S1) — surface them in the UI (export = download the spec JSON; import = paste JSON → `POST /blueprints/import`).
- **Control-plane UI:** a Blueprints management section: list with status, a **Capture** control (pick a tenant + key/name → capture), **Publish/Archive** buttons per blueprint, **Export** (download JSON), **Import** (paste JSON). The existing read-only blueprint list is upgraded to this.

Out of scope (later): a visual blueprint *editor* (edit spec fields in the UI), blueprint versioning/diffing, capturing business data (seed) — capture stays config-only by design; per-field template customization (that's the wizard, S4).

## Architecture
- **Backend:** two new routes on the existing `platformRouter` (behind `requirePlatformAdmin`, owner prisma): the capture route (wraps the existing `captureBlueprint`) and the status PATCH. Reuse `BlueprintSpec` validation. No schema changes — `Blueprint` already has `status`, `sourceTenantId`, `spec`.
- **Frontend:** extend `app/src/admin_platform.jsx` — add a Blueprints management block (mirrors the existing tenants-table conventions: `card`, `errBar`, `reload`, `setErr`). Export triggers a client-side JSON download; import is a textarea → POST.
- **Capture safety:** `captureBlueprint` is config-only (no tenant business rows), so a captured template never leaks one customer's data into another. The route re-validates with `BlueprintSpec.parse` before persisting (defense in depth).

## Error handling
- Capture: 404 unknown tenant, 409 duplicate blueprint key, 422 invalid captured spec, 400 missing key/name. Lifecycle PATCH: 400 invalid status, 404 unknown blueprint. All platform routes 401/403 via existing guards.
- Frontend: inline errors via the existing `setErr`; reload after each mutation.

## Testing
- API `blueprints-mgmt.test.mjs`: capture the demo tenant → a new DRAFT blueprint whose spec validates and has `sourceTenantId = tenant-dlpe-demo`; round-trip — provision a tenant from the captured blueprint succeeds (proves capture→provision works); PATCH status DRAFT→PUBLISHED→ARCHIVED; duplicate-key capture → 409; non-platform-admin → 403. Clean up captured blueprints + any provisioned test tenant (test-isolation: restore — delete what the test created; don't leak).
- Frontend: extend the control-plane Playwright journey — capture a blueprint from the demo tenant via the UI, see it appear in the list, publish it; clean up (delete the captured blueprint at the end, or use a unique key per run and tolerate it). Build must pass.

## Note on test isolation (S3/S6 lesson)
Any test that captures/creates a blueprint or provisions a tenant MUST delete what it created (FK-safe: subscription → users/roles/orgNodes/etc. → tenant; and the captured Blueprint row). The capture tests use unique keys (e.g. `cap-<n>`) and delete them in cleanup so repeated runs stay deterministic.
