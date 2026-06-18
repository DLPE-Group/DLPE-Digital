# DLPE → SaaS Platform — Roadmap & Decomposition

> **What this is.** A whole-journey map for turning DLPE Digital from a single hardcoded
> customer into a sellable, multi-tenant SaaS. It decomposes the work into subsystems,
> sequences them into launch waves, and names the minimum "sellable" cut. Each subsystem
> gets its **own** design spec + implementation plan later — this document is the index and
> the sequencing rationale, not an implementation plan.
>
> **Status:** roadmap approved in brainstorming 2026-06-18. The first build (S0+S1) has its
> own draft spec at `2026-06-02-customer-provisioning-design.md`.

## Anchors (from brainstorming)

- **Driver:** building toward a product launch — making DLPE *sellable* so we can start
  acquiring customers. Not a single named customer; not just a demo.
- **Customers & motion:** **hybrid** — self-serve SMB/mid-market *and* sales-led enterprise.
  Both motions are in scope; they are two front-ends on the same provisioning core.
- **Billing model:** tiers + per-seat, enterprise custom-quoted — but the **engine stays
  pluggable** (model expressed as `plans → entitlements`; pricing math behind Stripe/an
  adapter, so changing the model is config, not a migration).
- **Hosting:** DigitalOcean App Platform (build from this repo's Dockerfile, auto-deploy on
  push) + DigitalOcean **Managed Postgres**, **EU region** (data residency).
- **Isolation:** **shared container + managed DB + Postgres RLS** now; **dedicated
  per-tenant** reserved as a later enterprise tier via a clean seam (no rewrite).

## The platform is domain-agnostic — this is the core asset

DLPE is a **generic entity meta-model** (`TrackDef` / `StageDef` / `EntityType` /
`FieldDef` / `Entity`, with `kind: pipeline | reference`). Vehicle/fleet management is just
**one configured use case** — the demo blueprint. The same platform can be a bike registry,
ride on top of an invoicing system, run a sales pipeline, or model domains we haven't
imagined. **Each customer's domain is just a blueprint, not domain code.** This is *why*
provisioning + blueprints sit at the centre of the map: onboarding a customer = picking or
authoring a blueprint, never writing code.

> **Terminology note:** "fleet" in this project means the *vehicle* domain use case. For the
> infrastructure concept of "many dedicated environments," this doc says
> **"dedicated-deployment management"** — never "fleet" — to avoid collision.

## Subsystem map

Ten subsystems across four concerns. Branding, default integrations, and welcome emails are
folded in as **blueprint dimensions** (part of S1/S2), not separate subsystems.

**🔐 Foundation — makes multi-customer possible & safe**
- **S0 · Tenant isolation** — `Tenant` table, `tenantId` on every model, Postgres RLS so
  tenant A can never read tenant B. *Hard prerequisite for everything else.*
- **S1 · Provisioning engine** — one transactional, idempotent call that stands up a
  complete, isolated tenant from a blueprint. *Both motions call this.*
- **S2 · Blueprints / templates** — capture a live tenant's config as a reusable template;
  clone-from-previous. *Makes provisioning produce a real customer, not an empty shell.*

**🛠️ Operating it — your team runs the business**
- **S3 · Control plane** — internal admin: list / create / suspend / impersonate tenants,
  see health & usage; the registry of environments + versions (also serves rule 8 below).
- **S4 · Guided setup wizard** — the "launch in minutes" UX on top of S1, for sales-led
  onboarding.
- **S5 · Platform identity** — platform-admin tier (above tenant RBAC), tenant resolution
  from login, subdomains / custom domains, enterprise SSO/OIDC (`AuthProvider` seam).

**💳 Commercial — makes it sellable**
- **S6 · Billing & subscriptions** — Stripe integration, `plans → entitlements`
  (feature flags + limits), per-seat counting, enterprise custom invoicing, dunning /
  suspension. Engine pluggable.
- **S7 · Self-serve signup funnel** — public signup → email verify → trial sandbox → pick
  plan → pay → auto-provisioned tenant. (= S1 + S6 + abuse protection.)

**☁️ Running it for real — cross-cutting ops**
- **S8 · Hosting & deployment** — DigitalOcean EU, GitHub-connected CI/CD, secrets,
  backups, monitoring/observability. Governed by `DEPLOYMENT-RULES.md`.
- **S9 · Lifecycle & compliance** — tenant offboarding, data export, GDPR delete, billing
  dunning lifecycle. (Audit logging already exists.)

**Future seam**
- **S10 · Tenant migration & dedicated-deployment management** — promote a shared tenant to
  its own dedicated container + DB; manage many dedicated environments safely (staged
  rollout, version registry). Built when the first enterprise customer demands it.

## Sequencing — build waves

```
        S0 Tenant isolation  ◄──── hard prerequisite, nothing safe without it
              │
        S1 Provisioning engine  ◄── both motions call this
         │         │
    S2 Blueprints  │
         │         │
   ┌─────┴────┐    │
   ▼          ▼    ▼
 WAVE 2 (operate)        WAVE 3 (sell)
 S3 Control plane        S6 Billing
 S4 Setup wizard         S7 Self-serve funnel  (= S1 + S6 + abuse)
 S5 Platform identity
         ╲              ╱
          ▼            ▼
        S8 Hosting/ops  ◄── live before the FIRST paying customer; parallel with Wave 2
        S9 Lifecycle/compliance  ◄── export/delete before EU public launch
        S10 Dedicated mgmt  ◄── only when an enterprise customer requires it
```

- **Wave 1 — Foundation (S0 → S1 → S2).** Strictly sequential. Nothing can be isolated,
  sold, or self-served until a customer is a real, isolated `Tenant` we can stand up on
  demand. This is the critical path for *everything*.
- **Wave 2 — Operate (S3, S4, S5).** Unlocks the **sales-led** half of the hybrid motion.
- **Wave 3 — Sell (S6 → S7).** Billing first, then the self-serve funnel (literally
  S1 + S6 + glue). Unlocks the **self-serve** half.
- **Cross-cutting — S8 / S9.** Hosting is **not** last: the moment a real customer pays, we
  need EU hosting + backups + monitoring, so S8 lands before the first paying customer, in
  parallel with Wave 2. S9 export/delete must exist before an EU *public* launch.

## Minimum "sellable" cut

Launch ≠ all ten subsystems. It's the thinnest slice that lets a customer pay and use it
safely:

**Must-have to take the first dollar:** S0 (isolation), S1 (provision customer #2 without a
deploy), **S6 thin** (Stripe Checkout + a couple of plans + "is the subscription active?"
gate — no dunning/proration yet), S8 (live on DO EU, backups on), and a **minimal
onboarding path** (even just running the provisioning engine by hand / one control-plane
button — not the full wizard).

**Fast-follow (launch without; add within weeks):** S2 (start with one hardcoded default
blueprint — the dogfooded seed), S3 UI (CLI/script first), S4 wizard (hands-on sales-led
first), S5 custom domains/SSO (subdomains enough; SSO is an enterprise upsell), S7
self-serve (sell sales-led first, flip on self-serve once billing is proven), S9 full
compliance tooling, S10 dedicated management.

**Punchline:** the paused **S0 + S1** draft is exactly the right first build — the
irreducible core everything hangs off. Finish & approve that spec, build it, then choose
Wave 2 vs. Wave 3 ordering based on whether the first customers arrive sales-led or
self-serve.

## Cross-cutting design tenets (in force from S0)

1. **Every tenant is a self-contained, extractable unit.** `tenantId` on every row + RLS
   means a tenant's entire footprint is `WHERE tenant_id = X` — nothing more, nothing less.
   This is what makes a future **shared → dedicated migration** (S10) a feature you add, not
   a foundation you redo: `captureBlueprint(tenantId)` (config) + tenant-scoped data export
   → `provisionTenant(blueprint, dedicatedTarget)` → import → cut over.
2. **Billing stays pluggable.** Model as `plans → entitlements`; never bake tier/seat
   assumptions into the schema. Changing the pricing model is config, not a migration.
3. **Deployment discipline (`DEPLOYMENT-RULES.md`).** One identical image everywhere,
   config-only differences; forward-only **expand/contract** migrations applied
   automatically by the pipeline; shared pool as canary; high-revenue customers updated
   last. These prevent environment drift — the root cause of dedicated-deployment pain —
   and protect the shared deployment today. **Adopted now, before there is a fleet to tame.**
4. **Seams over rewrites.** `ProvisioningTarget` (shared now / dedicated later),
   `AuthProvider` (custom JWT now / SSO later), billing adapter — each is a declared
   interface so the deferred half slots in without touching callers.

## Next step

Finalize the **S0 + S1** spec (`2026-06-02-customer-provisioning-design.md`) — re-confirm
its three flagged judgment calls (CountryDefaults stays global; new platform-admin tier;
refactor `seed.ts` into the first `dlpe-demo` blueprint) — then proceed to its
implementation plan. Each later subsystem (S2…S10) gets its own spec → plan when its wave
comes up.
