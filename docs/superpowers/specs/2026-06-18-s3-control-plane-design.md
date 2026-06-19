# S3 — Control Plane (design)

> **Status:** design for subsystem **S3** of the SaaS roadmap (`2026-06-18-saas-platform-roadmap.md`). High-level intent was approved in the roadmap brainstorm; this is the focused spec. Builds on S1's `/api/platform/*` API and the platform-admin tier.

## Goal
Give the platform team an internal, **platform-admin-only** UI to operate the provisioning engine: see all tenants and their status, provision a new customer from a published blueprint, and suspend/reactivate a tenant. This is the first *visible* payoff of S0 (isolation) + S1 (provisioning).

## Scope (minimum useful control plane)
- **List tenants** — id, slug, name, status, tenancyMode, region, createdAt.
- **Provision a new customer** — pick a `PUBLISHED` blueprint, fill its declared `inputs`, submit → `POST /api/platform/tenants`; show the returned admin login/invite link.
- **Suspend / reactivate** a tenant — flip `Tenant.status` between `ACTIVE` and `SUSPENDED`.
- **List blueprints** — key, name, version, status (read-only list; authoring/capture UI is a later S2 concern).

Out of scope (later subsystems): the guided multi-step wizard (S4), branding/theming editors, blueprint authoring/capture UI (S2), billing (S6), impersonation/login-as-tenant.

## Architecture
- **Backend (small additions to S1):**
  - `GET /api/me/permissions` also returns `platformAdmin` (so the SPA can gate the nav). Currently returns `tenantId` + RBAC; add `platformAdmin`.
  - `PATCH /api/platform/tenants/:id` `{ status }` — set a tenant's status (`ACTIVE|SUSPENDED|ARCHIVED|TRIAL`), validated against the `TenantStatus` enum; platform-admin only (the router is already behind `requirePlatformAdmin`). Returns the updated tenant.
  - Existing S1 endpoints reused as-is: `GET /platform/tenants`, `GET /platform/blueprints`, `POST /platform/tenants` (provision).
- **Frontend:**
  - `me.platformAdmin` surfaced in `App.jsx` as `isPlatformAdmin`; a new `'platform'` view added to the admin-gated set (gated by `isPlatformAdmin`, NOT the tenant `isAdmin`/group-admin flag — platform admin is a *separate, higher* tier).
  - A side-menu item "Control plane" shown only when `isPlatformAdmin`.
  - `app/src/admin_platform.jsx` — the `ControlPlaneView` component, following the existing `DataModelView` pattern (reads via `api.get`, mutates via `api.post`/`api.patch`, surfaces errors, reloads). Sections: Tenants table (with Suspend/Reactivate buttons), a "Provision new customer" form (blueprint picker → dynamic inputs from the blueprint's `spec.inputs` → submit → result link), and a read-only Blueprints list.
- **Tenant-status semantics (this spec):** status is informational + a soft gate for the control plane. Enforcing SUSPENDED at login (blocking a suspended tenant's users) is noted as a follow-up — it belongs with the auth/lifecycle work (S9), not here. The control plane just sets the flag and shows it.

## Error handling
- Backend: invalid status → 400; unknown tenant → 404; provision failures surface the engine's structured error (422). All platform routes already 401/403 via `requireAuth`/`requirePlatformAdmin`.
- Frontend: every mutation surfaces the error message inline (same pattern as `DataModelView`'s `setErr`), then reloads.

## Testing
- API: `platform-control.test.mjs` — PATCH status (active→suspended→active) as platform-admin; non-platform-admin gets 403; invalid status 400; unknown id 404; `/me/permissions` returns `platformAdmin`.
- Frontend: a Playwright journey (`control-plane`) — log in as the platform admin, open Control plane, see the demo tenant, suspend then reactivate it. (Provisioning a full new tenant via the UI is asserted at the API layer; the journey covers nav + status toggle to keep it fast.)
- Build: `npm --workspace app run build` must succeed (frontend compiles).

## Note on platform-admin in the demo
The seed's `r.mertens` is the tenant `group-admin`. To exercise the control plane, a platform admin is needed: set `platformAdmin: true` on a seed user (e.g. `r.mertens`) in the `dlpe-demo` blueprint's user spec, OR document that platform-admin is granted out-of-band. This spec sets `r.mertens.platformAdmin = true` in the demo so the control plane is reachable in the running app.
