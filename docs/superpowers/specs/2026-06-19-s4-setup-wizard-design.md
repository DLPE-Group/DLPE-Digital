# S4 — Guided Setup Wizard — design

> **Status:** design for subsystem **S4** of the SaaS roadmap (Wave 2 — operate). Intent approved in the roadmap brainstorm ("the 'launch in minutes' UX on top of S1, for sales-led onboarding"). Builds on S1 (`provisionTenant`, `POST /api/platform/tenants`), S2 (blueprints), S3 (control plane), S6 (plans/entitlements). Executed autonomously in the established subagent-driven rhythm; the three judgment calls in **Decisions** below are flagged for the user to override if desired.

## Goal

Turn provisioning from a flat one-shot form into a **guided, validated, multi-step flow** an operator (sales/onboarding) can drive in minutes for a *real new customer*: pick a template, enter the customer's details, set **that customer's** admin contact and plan, see a **preflight summary** of exactly what will be created (and whether the slug is free) *before* committing, then provision and land on a success screen with the admin invite link.

The flat form in `ControlPlaneView` (works, but bakes the admin user into the blueprint and gives no pre-commit validation) is replaced by this wizard. No new persistence — this is a UX + a read-only preflight on top of the existing engine, plus two small, backward-compatible provision overrides.

## Why the current form is insufficient (the real gap)

`provisionTenant` always creates the admin user from `spec.adminUser` (name/email baked into the blueprint) and always assigns `spec.defaultPlanKey ?? 'starter'`. For a real sales-led onboarding the operator must set **the customer's** admin email (so the invite link reaches them) and choose a plan per deal. S4 adds exactly those two overrides — nothing more.

## Scope

### Backend (small, additive, backward-compatible)

1. **Provision overrides** — `POST /api/platform/tenants` accepts two new optional body fields, threaded into `provisionTenant`:
   - `admin?: { name?: string; email?: string }` → overrides `spec.adminUser.name` / `.email` for the created admin user (and thus the invite link target). Email validated; merge is field-wise (omitted fields keep the spec value).
   - `planKey?: string` → overrides `spec.defaultPlanKey` for the default subscription assignment. Unknown plan key does **not** fail provisioning (matches the existing "skip on bad plan" resilience); preflight surfaces it as an issue beforehand.
   - Both default to current behaviour when absent. `provisionTenant` gains optional `adminOverride?: { name?; email? }` and `planKey?` args.

2. **Preflight (read-only, no writes)** — `POST /api/platform/provision/preflight { blueprintKey, inputs }` returns a dry-run validation:
   ```
   {
     ok: boolean,                 // false if any blocking issue
     slug: string,                // computed via the same slugify rule as provisionTenant
     slugAvailable: boolean,      // no existing Tenant with that slug
     resolvedPlanKey: string,     // planKey override ?? spec.defaultPlanKey ?? 'starter'
     planExists: boolean,
     summary: {                   // generic counts — domain-agnostic, never "fleet"-specific
       orgNodes, roles, tracks, entityTypes, users, crossTriggers, seedEntities
     },
     adminEmail: string,          // resolved admin email (override ?? spec)
     issues: [{ level: 'error'|'warning', message }]
   }
   ```
   - Validates inputs against `spec.inputs` (reuses the same required-field logic as `provisionTenant`); missing required input → `error` issue. Slug taken → `error`. Plan missing → `warning` (provisioning proceeds, subscription skipped). `ok = issues has no 'error'`.
   - The route also accepts `admin?` / `planKey?` so the preview reflects the operator's choices. Owner prisma (like all platform routes); behind `requirePlatformAdmin`.

3. **Refactor for reuse:** extract `slugify` + the input-validation + the "resolve slug/name/region" logic currently inline in `provisionTenant` into small exported helpers (`server/src/domain/provisioning/derive.ts`) so preflight and provision compute identically (no drift between preview and reality). `provisionTenant` imports them — behaviour unchanged, covered by existing S1 tests.

### Frontend (the wizard)

`app/src/provision_wizard.jsx` — a self-contained multi-step component, mounted in `ControlPlaneView` in place of the flat "Provision new customer" section (same `card`/`fieldLabel`/`primaryBtn` styling conventions). Steps:

- **1 · Template** — pick a `PUBLISHED`-first blueprint (reuses the existing sorted list); show a one-line summary (name, version, status). Next disabled until chosen.
- **2 · Customer** — render `spec.inputs` dynamically (same control as today: text/email/number); include customer name → live-previewed slug.
- **3 · Admin & plan** — admin name + email (prefilled from `spec.adminUser`, editable), plan `<select>` (from `/platform/plans`, default = `spec.defaultPlanKey`).
- **4 · Review** — call preflight; render the summary counts, resolved slug + availability, plan, admin email, and any issues. **Provision** is enabled only when `ok`. Re-runs preflight if the operator steps back and edits.
- **5 · Done** — success: tenant slug, admin invite link (copy-to-clipboard), "Provision another" reset. On failure, show the error and keep the operator on Review.

Back/Next navigation; per-step validation gates Next. Idempotency key derived as today (`cp-<bpKey>-<slug-or-customerName>`), stable across retries.

## Out of scope (later / other subsystems)
Visual blueprint *editing* (S2 follow-up), email actually sending the invite (stays simulated; the link is shown/copied), self-serve public signup (S7 — this wizard is operator-only, behind platform-admin), tenant-resolution-at-login / subdomains / SSO (S5), per-field blueprint customization at provision time. The wizard does not create plans or blueprints — it consumes them.

## Error handling
- Preflight: 400 missing `blueprintKey`; 404 unknown blueprint; 422 stored spec invalid (same as provision). Validation problems are returned as `issues`, **not** HTTP errors — preflight always 200 when the blueprint resolves, so the UI can render the summary + issues together.
- Provision: unchanged (201 / 400 / 404 / 422). Bad `admin.email` → 400. Frontend shows inline errors via the existing `errBar`/`setErr` pattern; the wizard stays on the step that failed.

## Testing
- **API `provision-wizard.test.mjs`:**
  - preflight on the demo blueprint with valid inputs → `ok:true`, correct `summary` counts (assert against the demo blueprint's known shape), `slugAvailable` reflects a fresh slug, `resolvedPlanKey` honours a `planKey` override.
  - preflight with a missing required input → `ok:false` + an `error` issue; with a slug that collides with an existing tenant → `slugAvailable:false` + `error`; with an unknown `planKey` → `planExists:false` + a `warning`, `ok` still true.
  - provision with `admin: { name, email }` override → created admin user has the overridden email (invite link targets it); with `planKey` override → tenant's subscription is that plan.
  - non-platform-admin → 403 on both routes.
  - **Test isolation (S3/S6/S2 lesson):** every test that provisions deletes what it created (FK-safe: subscription → users/roles/orgNodes/trackDefs/entityTypes/etc. → tenant) using unique slugs per run; restore demo state in `afterAll`; suite must pass run-twice.
- **Frontend `setup-wizard.spec.mjs`:** drive the wizard end-to-end against the demo blueprint with a unique customer name — Template → Customer → Admin & plan → Review (assert summary + slug-available render) → Provision → Done (assert invite link shown). Clean up the provisioned tenant at the end (or unique-slug + tolerate). Build must pass.
- Existing S1 `provisionTenant` tests stay green after the `derive.ts` extraction (proves no behavioural drift).

## Decisions (judgment calls — flag for override)
1. **Replace, not add:** the wizard *replaces* the flat provision form rather than living beside it — one provisioning entry point avoids two diverging code paths. (Capture/import blueprint sections in the control plane are untouched.)
2. **Preflight returns issues, not HTTP errors:** validation results ride in the 200 body so the review screen renders summary + problems together; only structural failures (unknown blueprint, invalid stored spec) are HTTP errors.
3. **Admin override is name/email only:** role/scope stay as the blueprint defines (the admin's RBAC is a template concern, not a per-onboarding input). Setting the admin's *role* is out of scope.
