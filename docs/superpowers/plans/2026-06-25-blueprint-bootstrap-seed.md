# Blueprint Bootstrap + Provisioner Seed Fix — Implementation Plan

> **For agentic workers:** Branch `blueprint-bootstrap-seed`. Verified in the local Docker stack before any prod deploy. Trailer ends `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

**Goal:** Give a fresh production DB usable templates to provision from — a clean config-only starter, a reusable populated sample (demo data, no fixed users), and the one-time full demo — and fix the provisioner so seed-bearing blueprints actually clone via the control plane.

**Architecture:** Production is set up by `bootstrap-admin` (admin only, no blueprints). The full `seed.ts` (which creates blueprints) can't run in the slim runtime image. So we add a compiled `bootstrap-blueprints` step (runs in the slim image, idempotent upsert) wired into the POST_DEPLOY job. The seed business data lives *in* a blueprint's `spec.seed` block; the provisioner writes it per-tenant. That seed path was only exercised in `idMode:'literal'` (the demo seed) — in `prefixed` mode (control-plane provisioning) it FK-breaks because it namespaces an entity's own id but not its references. We fix that.

**Tech Stack:** Prisma 6, Express, Node (slim runtime image), vitest.

## Global Constraints
- Private identity only (`kennetfrahm` / `kennetfrahm@gmail.com`). Never mix A18n.
- Never run `prisma migrate dev/reset`. No schema changes in this plan.
- Idempotent: re-running bootstrap must not duplicate or mutate existing real data.
- Literal-mode behaviour (the demo seed, 153-test baseline) must stay byte-for-byte unchanged — the fix only affects `prefixed` mode.
- No deploy without explicit user confirmation after local Docker verification.

---

### Task 1: Provisioner namespaces seed cross-references in prefixed mode

**Files:** `server/src/domain/provisioning/provisionTenant.ts`, `tests/api/provision-tenant.test.mjs`.

The seed-writer (5h, 5h-extras, 5j) must prefix FK references when `idMode==='prefixed'` (leave verbatim when `'literal'`):
- `Entity.companyId` for seed cards + vehicles + portal vehicles → `OrgNode` id.
- `portalFleet.operatorCompanyId` (drives `fleetOperator.companyId` + `invoice.companyId`).
- `extras.fleetOperators[].companyId`.
- `report.createdById` → `User` id.
- `dashboard.userId` → `User` id.

Helper: `const prefId = (id) => idMode === 'literal' || !id ? id : \`${pfx}${id}\``.

TDD: add a prefixed-mode test that provisions a small spec carrying a `seed.entities` row with `companyId` pointing at an org node in the same spec; assert the created Entity's `companyId === \`${slug}-<node>\`` and provisioning does not throw. (Fails today — FK violation / dangling ref.)

### Task 2: Shared blueprint templates module

**Files:** Create `server/src/domain/provisioning/templates.ts`; refactor `server/prisma/seed.ts` to consume it.

Export three blueprint descriptors derived from `dlpeDemoBlueprint` (DRY — one source of structure):
- `starterBlueprint` — key `dlpe-starter`, PUBLISHED. Spec = demo spec minus `seed` and `users`; `adminUser` overridden to the per-onboarding placeholder (`idPrefix:'u-admin'`, `email:'admin@change-me.example'`).
- `sampleBlueprint` — key `dlpe-sample`, PUBLISHED. Spec = starter base **+ `seed`** = `{ entities, extras }` where `extras` omits `reports` + `dashboard` (both FK to staff users we don't create). Keeps vehicleTimeline, portalFleet, fleetOperators, integrations, audit, rbacVersions. No `users`. Admin placeholder as above.
- `demoBlueprint` — re-export of `dlpeDemoBlueprint` (full spec, DRAFT) for one-time literal-mode demo cloning.

`seed.ts` keeps provisioning the demo tenant (literal) but now upserts all three blueprints via the shared descriptors (today it inlines starter; add sample).

### Task 3: bootstrap-blueprints script

**Files:** Create `server/src/scripts/bootstrap-blueprints.ts`; `server/package.json` (script alias).

Compiled (`dist/scripts/bootstrap-blueprints.js`) so it runs in the slim image. Uses the owner `prisma` client (bypass RLS by ownership). Idempotent: `prisma.blueprint.upsert` by `key` for starter (PUBLISHED), sample (PUBLISHED), demo (DRAFT). Does **not** provision any tenant — templates only; provisioning stays a control-plane action. Add `"bootstrap:blueprints": "node dist/scripts/bootstrap-blueprints.js"`.

### Task 4: Wire POST_DEPLOY

**Files:** `.do/app.yaml`, `docs/DEPLOY-DIGITALOCEAN.md`.

Run `npm run bootstrap:blueprints` in the POST_DEPLOY job after `bootstrap:admin`. Document that a fresh prod DB now self-provisions the three templates.

### Task 5: Local Docker verification (no prod)

Rebuild the local stack from the branch. Then, against localhost:4000 as the platform admin via the control plane (prefixed mode):
- Provision a company from `dlpe-sample` → succeeds, tenant is **populated** (cards, vehicles, portal, integrations, audit), no FK error.
- Provision a company from `dlpe-starter` → succeeds, **clean/empty** business data.
- Confirm the demo tenant (literal seed) is unchanged.
Report what was verified. Do NOT deploy.
