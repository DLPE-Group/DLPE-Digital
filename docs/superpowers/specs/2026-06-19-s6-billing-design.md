# S6 — Billing & Subscriptions (thin) — design

> **Status:** design for subsystem **S6** of the SaaS roadmap. High-level intent approved in the roadmap brainstorm ("tiers + per-seat, enterprise custom-quoted, engine stays pluggable"). This spec is the **thin** slice from the roadmap's minimum-sellable cut: a couple of plans, a per-tenant subscription, an entitlement gate, and a pluggable/simulated provider. No dunning/proration/real Stripe.

## Goal
Make a tenant *sellable*: every tenant has a **subscription** to a **plan**, the app can answer "is this tenant paid/active?" and "does this tenant's plan include feature X / allow N of Y?", and a platform admin can see/change a tenant's plan. Real payment capture (Stripe) is a later swap behind a seam.

## Core model: `plans → entitlements` (pluggable by construction)
- **`Plan`** (platform-level, like Blueprint — no tenantId): `id, key (unique, e.g. starter|pro|enterprise), name, tier (int, for ordering), priceMonthly (int, minor units, informational), currency, entitlements (Json), active (bool)`.
  - **`entitlements`** = `{ features: string[], limits: Record<string, number> }` — e.g. `features: ['reports','api_access']`, `limits: { maxUsers: 10, maxEntities: 5000 }`. This is the single source of what a plan grants; **switching the pricing model = editing entitlements/plans, not migrating schema** (the roadmap "stays pluggable" tenet).
- **`Subscription`** (one per tenant): `id, tenantId (unique), planId, status (TRIALING|ACTIVE|PAST_DUE|CANCELED), provider (string, 'simulated'|'stripe'), providerRef (string?), currentPeriodEnd (DateTime?), seats (int?), createdAt/updatedAt`.
- A tenant is "billable-active" when `status ∈ {TRIALING, ACTIVE}`.

## Provider seam (mirrors `AuthProvider` / `ProvisioningTarget`)
- **`BillingProvider`** interface: `createSubscription({ tenantId, planKey, seats? })`, `changePlan({ tenantId, planKey })`, `cancel({ tenantId })` → all return the resulting subscription state. (`checkoutUrl?` reserved for the real Stripe flow.)
- **`SimulatedBillingProvider`** (default, like Nango/email simulated): records the subscription in the DB, sets `provider: 'simulated'`, `status: 'ACTIVE'` (or `TRIALING` for new tenants), `currentPeriodEnd = +30 days`. No external calls.
- **`StripeBillingProvider`** declared but throws `Error('Stripe billing is deferred to a future spec')` — the seam that honors real payments later.

## Entitlement enforcement (thin)
- `server/src/domain/billing/entitlements.ts`:
  - `loadEntitlements(tenantId)` → `{ planKey, status, features, limits }` (joins Subscription→Plan; falls back to a free/no-plan default if a tenant has no subscription).
  - `tenantHasFeature(tenantId, feature)` → boolean.
  - `tenantWithinLimit(tenantId, limitKey, currentCount)` → boolean (true if no limit set).
  - `isBillableActive(tenantId)` → boolean.
- **One real gate wired now (proof, not breadth):** enforce `limits.maxUsers` on tenant user creation — `POST /admin/users` rejects (402 Payment Required or 403 with a clear message) when the tenant is at its plan's `maxUsers`. Everything else (feature flags, other limits) is available via the helpers for later wiring. (Avoid over-gating; the roadmap warns against breadth here.)
- Suspended/canceled login enforcement remains an S9 concern (consistent with S3's deferral).

## Provisioning integration
- `provisionTenant` assigns a **default subscription** via the `BillingProvider` (simulated): a new tenant gets the blueprint's declared default plan (a new optional `defaultPlanKey` on `BlueprintSpec`, falling back to `starter`) at status `TRIALING`. Atomic with the rest of provisioning where practical; if simpler, created immediately after the provision transaction (the subscription is tenant-scoped data — created as owner, like the rest).
- The demo (`dlpe-demo`) gets an `enterprise` plan, `ACTIVE`.

## Platform / control-plane integration
- API (behind `requirePlatformAdmin`): `GET /platform/plans` (list), `GET /platform/tenants/:id/subscription`, `PATCH /platform/tenants/:id/subscription { planKey }` (change plan via the provider).
- Control plane UI: show each tenant's plan + subscription status in the tenants table; a per-tenant plan `<select>` to change it.

## Seed
- Seed 3 plans globally (outside any tenant blueprint, like CountryDefaults): `starter` (maxUsers 10, features [reports]), `pro` (maxUsers 50, features [reports, api_access]), `enterprise` (maxUsers null/unlimited, all features). The demo tenant → `enterprise`/ACTIVE.

## Error handling
- Unknown plan key → 404; invalid body → 400; over-limit user create → 402 with `{ error, limit, current }`. Platform routes 401/403 via existing guards. Provider `changePlan` on a missing subscription creates one (idempotent-ish) or 404 — pick create-if-absent for resilience.

## Testing
- API `billing.test.mjs`: plans seeded + `GET /platform/plans`; demo tenant has an `enterprise` ACTIVE subscription; `tenantHasFeature`/`tenantWithinLimit`/`isBillableActive` unit-ish via the API or direct import; `PATCH …/subscription` changes plan (platform-admin only; 403 for others); the `maxUsers` gate blocks the 11th user on a `starter`-capped test tenant and allows it after upgrading to `pro`.
- Full API suite stays green; frontend builds; a short Playwright assertion that the control plane shows the demo tenant's plan.

## Out of scope (later)
Dunning, proration, invoices/receipts, real Stripe checkout + webhooks, per-seat *enforcement* beyond the count gate, usage metering, self-serve signup (S7), tax. The seam + entitlement model make these additive.
