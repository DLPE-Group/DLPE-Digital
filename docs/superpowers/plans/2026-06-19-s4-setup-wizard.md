# S4 — Guided Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat provisioning form with a guided, validated multi-step wizard that lets an operator set the new customer's admin + plan and preview exactly what will be created before committing.

**Architecture:** Two small backend additions on the existing `platformRouter` — a read-only `preflight` route and two backward-compatible provision overrides (`admin`, `planKey`) — both computing via shared helpers extracted from `provisionTenant` so preview and reality never drift. A self-contained React wizard (`provision_wizard.jsx`) mounted in `ControlPlaneView`.

**Tech Stack:** Express + Prisma 6, Zod (`@dlpe/shared` BlueprintSpec), React (Vite), Vitest (API) + Playwright (UI).

## Global Constraints

- All `/api/platform/*` routes are already behind `requirePlatformAdmin` (mounted in `server/src/index.ts:101`) — new routes inherit the guard; the 403 test just sends a non-platform-admin token.
- Owner `prisma` client for platform routes (bypasses RLS), matching the rest of `platform.ts`.
- Provision overrides MUST default to current behaviour when absent (backward compatible — existing S1 tests stay green).
- Preflight performs NO database writes.
- Domain-agnostic: summary counts are generic (`orgNodes, roles, tracks, entityTypes, users, crossTriggers, seedEntities`) — never "fleet"/vehicle-specific.
- Slug computed by the SAME rule as `provisionTenant` (the extracted `slugify`) — preview must equal reality.
- Commit trailer ends: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Migrations: none (no schema change). Never run `prisma migrate dev`/`reset`.
- Test isolation (S3/S6/S2 lesson): any test that provisions deletes what it created (FK-safe order) with unique slugs; restore demo state in `afterAll`; suite passes run-twice.

---

### Task 1: Extract provisioning derivation helpers (`derive.ts`)

**Files:**
- Create: `server/src/domain/provisioning/derive.ts`
- Modify: `server/src/domain/provisioning/provisionTenant.ts` (replace inline `slugify`, input validation, slug/name/region resolution with imports)
- Test: covered by existing `tests/api/provision-tenant.test.mjs` (no new test; behaviour must be unchanged)

**Interfaces:**
- Produces:
  - `slugify(s: string): string`
  - `validateInputs(spec: BlueprintSpec, inputs: Record<string, unknown>): { ok: boolean; missing: string[] }`
  - `resolveSlugName(spec: BlueprintSpec, inputs: Record<string, unknown>): { slug: string; name: string; region: string }`
  - `resolvePlanKey(spec: BlueprintSpec, planKey?: string): string`
  - `summarizeBlueprint(spec: BlueprintSpec): { orgNodes: number; roles: number; tracks: number; entityTypes: number; users: number; crossTriggers: number; seedEntities: number }`

- [ ] **Step 1: Write `derive.ts`**

```ts
/* ============================================================
   derive.ts — pure derivation helpers shared by provisionTenant
   and the preflight route, so preview and reality never drift.
   No DB access; no side effects.
   ============================================================ */
import { z } from 'zod';
import type { BlueprintSpec } from '@dlpe/shared';

/** Slugify a display name → URL/subdomain-safe lowercase string. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

/** Validate runtime inputs against spec.inputs (required-field presence). */
export function validateInputs(
  spec: BlueprintSpec,
  inputs: Record<string, unknown>,
): { ok: boolean; missing: string[] } {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of spec.inputs) {
    const base: z.ZodTypeAny = z.string();
    shape[field.key] = field.required ? base : base.optional();
  }
  const parsed = z.object(shape).safeParse(inputs);
  if (parsed.success) return { ok: true, missing: [] };
  const missing = parsed.error.issues.map((i) => String(i.path[0]));
  return { ok: false, missing };
}

/** Resolve slug/name/region exactly as provisionTenant does. */
export function resolveSlugName(
  spec: BlueprintSpec,
  inputs: Record<string, unknown>,
): { slug: string; name: string; region: string } {
  const slug =
    typeof inputs.slug === 'string' && inputs.slug
      ? slugify(inputs.slug)
      : slugify((inputs.customerName as string | undefined) ?? spec.adminUser.name);
  const name = (inputs.customerName as string | undefined) ?? slug;
  const region = (inputs.region as string | undefined) ?? 'eu';
  return { slug, name, region };
}

/** Resolve the default plan key: explicit override → spec default → 'starter'. */
export function resolvePlanKey(spec: BlueprintSpec, planKey?: string): string {
  return planKey ?? spec.defaultPlanKey ?? 'starter';
}

/** Count nodes in an org-node tree. */
function countOrgNodes(node: BlueprintSpec['orgStructure']): number {
  let n = 1;
  for (const c of node.children ?? []) n += countOrgNodes(c);
  return n;
}

/** Generic, domain-agnostic counts of what a blueprint will create. */
export function summarizeBlueprint(spec: BlueprintSpec) {
  return {
    orgNodes: countOrgNodes(spec.orgStructure),
    roles: spec.roles.length,
    tracks: spec.tracks.length,
    entityTypes: spec.entityTypes.length,
    users: spec.users?.length ?? 0,
    crossTriggers: spec.crossTriggers.length,
    seedEntities: spec.seed?.entities?.length ?? 0,
  };
}
```

- [ ] **Step 2: Refactor `provisionTenant.ts` to use the helpers**

Remove the local `slugify` function (lines ~59-66). Add to the import block near the top:
```ts
import { slugify, validateInputs, resolveSlugName } from './derive.js';
```
Replace the inline input-validation block (the `shape`/`InputSchema`/`parsed` section, ~lines 120-130) with:
```ts
  // 1. Validate inputs against spec.inputs
  const inputCheck = validateInputs(spec, inputs);
  if (!inputCheck.ok) {
    throw new Error(`Invalid inputs: ${inputCheck.missing.join(', ')}`);
  }
```
Replace the slug/name/region derivation block (~lines 135-140) with:
```ts
  // 2. Derive slug + name + region
  const { slug, name, region } = resolveSlugName(spec, inputs);
```
Leave everything else unchanged (the local `slugify` is now imported; `randomUUID` etc. stay).

- [ ] **Step 3: Build server + typecheck**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the S1 provisioning tests to prove no behavioural drift**

Run: `node tests/prepare-db.mjs && npx vitest run tests/api/provision-tenant.test.mjs`
Expected: all pass (slug, idempotency, id-mode behaviour unchanged).

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/provisioning/derive.ts server/src/domain/provisioning/provisionTenant.ts
git commit -m "S4 Task 1: extract provisioning derive helpers (slugify/validate/resolve/summarize)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Provision overrides — `admin` + `planKey`

**Files:**
- Modify: `server/src/domain/provisioning/provisionTenant.ts` (add `adminOverride`, `planKey` args; merge admin; use planKey for subscription)
- Modify: `server/src/routes/platform.ts` (`POST /tenants` accepts `admin`, `planKey`)
- Test: `tests/api/provision-wizard.test.mjs` (new — override cases here; preflight cases added in Task 3)

**Interfaces:**
- Consumes: `provisionTenant` from Task 1 (unchanged signature except new optional args).
- Produces: `ProvisionTenantArgs` gains `adminOverride?: { name?: string; email?: string }` and `planKey?: string`.

- [ ] **Step 1: Write the failing test**

Create `tests/api/provision-wizard.test.mjs`:
```js
// tests/api/provision-wizard.test.mjs
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { post, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');

// FK-safe teardown of a provisioned tenant (mirrors blueprints-mgmt.test.mjs)
async function destroyTenant(tid) {
  await prisma.subscription.deleteMany({ where: { tenantId: tid } });
  await prisma.userScope.deleteMany({ where: { tenantId: tid } });
  await prisma.user.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldRule.deleteMany({ where: { tenantId: tid } });
  await prisma.stageDef.deleteMany({ where: { tenantId: tid } });
  await prisma.stageConfig.deleteMany({ where: { tenantId: tid } });
  await prisma.fieldDef.deleteMany({ where: { tenantId: tid } });
  await prisma.entityType.deleteMany({ where: { tenantId: tid } });
  await prisma.trackDef.deleteMany({ where: { tenantId: tid } });
  await prisma.crossTrigger.deleteMany({ where: { tenantId: tid } });
  await prisma.role.deleteMany({ where: { tenantId: tid } });
  await prisma.orgNode.deleteMany({ where: { tenantId: tid } });
  await prisma.provisioningRun.deleteMany({ where: { tenantId: tid } });
  await prisma.tenant.delete({ where: { id: tid } });
}

const created = [];
afterAll(async () => {
  for (const tid of created) { try { await destroyTenant(tid); } catch {} }
  await prisma.$disconnect();
});

describe('provision overrides', () => {
  it('honours admin + planKey overrides', async () => {
    const r = await post('/platform/tenants', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-ovr', customerName: 'S4 Override Co' },
      admin: { name: 'Wizard Admin', email: 'wizard.admin@s4ovr.test' },
      planKey: 'pro',
      idempotencyKey: 's4-ovr-1',
    }, PLATFORM());
    expect(r.status).toBe(201);
    const tid = r.body.tenantId;
    created.push(tid);
    // admin user carries the overridden email + name
    const admin = await prisma.user.findFirst({ where: { tenantId: tid, email: 'wizard.admin@s4ovr.test' } });
    expect(admin).toBeTruthy();
    expect(admin.name).toBe('Wizard Admin');
    // subscription is the overridden plan
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tid }, include: { plan: true } });
    expect(sub?.plan?.key).toBe('pro');
  });

  it('rejects an invalid admin email (400)', async () => {
    const r = await post('/platform/tenants', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-bad', customerName: 'Bad' },
      admin: { email: 'not-an-email' },
      idempotencyKey: 's4-bad-1',
    }, PLATFORM());
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/prepare-db.mjs && npx vitest run tests/api/provision-wizard.test.mjs`
Expected: FAIL (overrides not implemented — admin email not found / plan not `pro`).

- [ ] **Step 3: Add the args + logic to `provisionTenant.ts`**

In `ProvisionTenantArgs` add:
```ts
  /** Override the blueprint's admin user name/email (per-onboarding). Field-wise merge. */
  adminOverride?: { name?: string; email?: string };
  /** Override the default subscription plan key (else spec.defaultPlanKey ?? 'starter'). */
  planKey?: string;
```
Near the top of the function where `spec` is read, build an effective admin user. Replace the single `const adminUser = spec.adminUser;` (~line 613) with use of a merged object computed once at function top so both the hash step and the create step use it. Add right after `const spec = blueprint.spec;`:
```ts
  const effectiveAdmin = {
    ...spec.adminUser,
    ...(args.adminOverride?.name ? { name: args.adminOverride.name } : {}),
    ...(args.adminOverride?.email ? { email: args.adminOverride.email } : {}),
  };
```
Then replace every read of `spec.adminUser` used for the admin user's own fields with `effectiveAdmin`:
- the hash block (`if (spec.adminUser.password)` → `if (effectiveAdmin.password)`)
- `const adminUser = spec.adminUser;` → `const adminUser = effectiveAdmin;`
(`adminUser.idPrefix`, `.roleId`, `.scopeType` etc. then come from `effectiveAdmin`, which spreads the spec values for everything not overridden.)

Replace the subscription assignment plan key (~line 778):
```ts
        planKey: resolvePlanKey(spec, args.planKey),
```
and add `resolvePlanKey` to the `./derive.js` import.

- [ ] **Step 4: Thread overrides through the route**

In `server/src/routes/platform.ts`, `POST /tenants` handler — extend the body destructure and validate the email:
```ts
  const { blueprintKey, inputs, idempotencyKey, admin, planKey } = req.body as {
    blueprintKey?: string;
    inputs?: Record<string, unknown>;
    idempotencyKey?: string;
    admin?: { name?: string; email?: string };
    planKey?: string;
  };
```
After the existing `blueprintKey` guard, add:
```ts
  if (admin?.email !== undefined && !z.string().email().safeParse(admin.email).success) {
    return res.status(400).json({ error: 'admin.email must be a valid email' });
  }
```
Pass into `provisionTenant`:
```ts
      idempotencyKey,
      adminOverride: admin,
      planKey,
```

- [ ] **Step 5: Build + run the test**

Run: `cd server && npx tsc --noEmit && cd .. && node tests/prepare-db.mjs && npx vitest run tests/api/provision-wizard.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/domain/provisioning/provisionTenant.ts server/src/routes/platform.ts tests/api/provision-wizard.test.mjs
git commit -m "S4 Task 2: provision overrides (admin name/email + planKey)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Preflight route

**Files:**
- Modify: `server/src/routes/platform.ts` (add `POST /provision/preflight`)
- Test: `tests/api/provision-wizard.test.mjs` (add a `preflight` describe block)

**Interfaces:**
- Consumes: `validateInputs`, `resolveSlugName`, `resolvePlanKey`, `summarizeBlueprint` from `derive.ts`; `BlueprintSpec` from `@dlpe/shared`.
- Produces: `POST /api/platform/provision/preflight` → `{ ok, slug, slugAvailable, resolvedPlanKey, planExists, summary, adminEmail, issues }`.

- [ ] **Step 1: Write the failing test (append to `provision-wizard.test.mjs`)**

```js
import { get } from '../helpers.mjs'; // add to the existing import line

describe('preflight', () => {
  it('returns a valid summary for the demo blueprint', async () => {
    // expected counts computed from the stored demo spec — no brittle hardcoding
    const bp = (await get('/platform/blueprints', PLATFORM())).body.find((b) => b.key === 'dlpe-demo');
    const spec = bp.spec;
    const expectRoles = spec.roles.length;

    const r = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 's4-pf-fresh', customerName: 'S4 PF Fresh' },
      planKey: 'pro',
    }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.slug).toBe('s4-pf-fresh');
    expect(r.body.slugAvailable).toBe(true);
    expect(r.body.resolvedPlanKey).toBe('pro');
    expect(r.body.planExists).toBe(true);
    expect(r.body.summary.roles).toBe(expectRoles);
    expect(r.body.summary.tracks).toBe(spec.tracks.length);
    expect(r.body.summary.entityTypes).toBe(spec.entityTypes.length);
  });

  it('flags missing required inputs as an error', async () => {
    const r = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: {}, // omit required inputs
    }, PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('flags a taken slug and an unknown plan', async () => {
    // demo slug is taken
    const taken = await post('/platform/provision/preflight', {
      blueprintKey: 'dlpe-demo',
      inputs: { slug: 'dlpe-demo', customerName: 'X' },
      planKey: 'no-such-plan',
    }, PLATFORM());
    expect(taken.status).toBe(200);
    expect(taken.body.slugAvailable).toBe(false);
    expect(taken.body.issues.some((i) => i.level === 'error')).toBe(true); // taken slug blocks
    expect(taken.body.planExists).toBe(false);
    expect(taken.body.issues.some((i) => i.level === 'warning')).toBe(true); // unknown plan warns
  });

  it('404 on unknown blueprint; 403 for non-admins', async () => {
    expect((await post('/platform/provision/preflight', { blueprintKey: 'nope', inputs: {} }, PLATFORM())).status).toBe(404);
    expect((await req('POST', '/platform/provision/preflight', { body: { blueprintKey: 'dlpe-demo', inputs: {} }, tok: NON() })).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node tests/prepare-db.mjs && npx vitest run tests/api/provision-wizard.test.mjs`
Expected: FAIL (route 404s — not yet defined).

- [ ] **Step 3: Implement the route in `platform.ts`**

Add the import:
```ts
import { validateInputs, resolveSlugName, resolvePlanKey, summarizeBlueprint } from '../domain/provisioning/derive.js';
```
Add the route (after `POST /tenants`):
```ts
// POST /api/platform/provision/preflight — dry-run validation + summary (no writes)
platformRouter.post('/provision/preflight', async (req, res) => {
  const { blueprintKey, inputs, admin, planKey } = req.body as {
    blueprintKey?: string;
    inputs?: Record<string, unknown>;
    admin?: { name?: string; email?: string };
    planKey?: string;
  };
  if (!blueprintKey) return res.status(400).json({ error: 'blueprintKey is required' });

  const blueprint = await prisma.blueprint.findUnique({ where: { key: blueprintKey } });
  if (!blueprint) return res.status(404).json({ error: `Blueprint not found: ${blueprintKey}` });

  const specParsed = BlueprintSpec.safeParse(blueprint.spec);
  if (!specParsed.success) {
    return res.status(422).json({ error: 'Stored blueprint spec is invalid', details: specParsed.error.issues });
  }
  const spec = specParsed.data;
  const safeInputs = inputs ?? {};

  const issues: Array<{ level: 'error' | 'warning'; message: string }> = [];

  // inputs
  const inputCheck = validateInputs(spec, safeInputs);
  if (!inputCheck.ok) {
    issues.push({ level: 'error', message: `Missing required inputs: ${inputCheck.missing.join(', ')}` });
  }

  // slug
  const { slug } = resolveSlugName(spec, safeInputs);
  const slugTaken = (await prisma.tenant.findUnique({ where: { slug } })) != null;
  if (slugTaken) issues.push({ level: 'error', message: `Slug already in use: ${slug}` });

  // plan
  const resolvedPlanKey = resolvePlanKey(spec, planKey);
  const planExists = (await prisma.plan.findUnique({ where: { key: resolvedPlanKey } })) != null;
  if (!planExists) issues.push({ level: 'warning', message: `Unknown plan '${resolvedPlanKey}' — subscription will be skipped` });

  const adminEmail = admin?.email ?? spec.adminUser.email;

  return res.json({
    ok: !issues.some((i) => i.level === 'error'),
    slug,
    slugAvailable: !slugTaken,
    resolvedPlanKey,
    planExists,
    summary: summarizeBlueprint(spec),
    adminEmail,
    issues,
  });
});
```

- [ ] **Step 4: Build + run**

Run: `cd server && npx tsc --noEmit && cd .. && node tests/prepare-db.mjs && npx vitest run tests/api/provision-wizard.test.mjs`
Expected: PASS (all override + preflight cases).

- [ ] **Step 5: Run the FULL API suite twice (determinism / isolation)**

Run: `node tests/prepare-db.mjs && npx vitest run tests/api && npx vitest run tests/api`
Expected: green both times (no leaked state from the new tenants).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/platform.ts tests/api/provision-wizard.test.mjs
git commit -m "S4 Task 3: provision preflight route (dry-run validation + summary)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wizard component (`provision_wizard.jsx`)

**Files:**
- Create: `app/src/provision_wizard.jsx`
- Test: build only (component wired + e2e in Task 5)

**Interfaces:**
- Consumes: `api` from `./api/client.js` (`api.get`, `api.post`); `Icon` from `./icons.jsx`.
- Produces: `export const ProvisionWizard = ({ onProvisioned }) => …` — accepts an optional `onProvisioned()` callback the host calls `reload()` from.

- [ ] **Step 1: Write the component**

```jsx
import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

/* S4 — Guided setup wizard. Multi-step provisioning for sales-led onboarding.
   Steps: 1 Template · 2 Customer · 3 Admin & plan · 4 Review (preflight) · 5 Done.
   Styling mirrors admin_platform.jsx (card/fieldLabel/primaryBtn). */

const STEPS = ['Template', 'Customer', 'Admin & plan', 'Review', 'Done'];

export const ProvisionWizard = ({ onProvisioned }) => {
  const [step, setStep] = React.useState(0);
  const [blueprints, setBlueprints] = React.useState([]);
  const [plans, setPlans] = React.useState([]);
  const [err, setErr] = React.useState(null);

  const [bpKey, setBpKey] = React.useState('');
  const [inputs, setInputs] = React.useState({});
  const [adminName, setAdminName] = React.useState('');
  const [adminEmail, setAdminEmail] = React.useState('');
  const [planKey, setPlanKey] = React.useState('');

  const [preflight, setPreflight] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    Promise.all([api.get('/platform/blueprints'), api.get('/platform/plans')])
      .then(([b, p]) => { setBlueprints(b); setPlans(p); })
      .catch((e) => setErr(e.message));
  }, []);

  const sortedBps = [...blueprints].sort((a, b) =>
    a.status === 'PUBLISHED' && b.status !== 'PUBLISHED' ? -1
      : a.status !== 'PUBLISHED' && b.status === 'PUBLISHED' ? 1 : 0);
  const selectedBp = blueprints.find((b) => b.key === bpKey) || null;
  const specInputs = selectedBp?.spec?.inputs || [];

  // When a blueprint is chosen, prefill admin + plan from its spec.
  const chooseBp = (key) => {
    setBpKey(key);
    const bp = blueprints.find((b) => b.key === key);
    setInputs({});
    setAdminName(bp?.spec?.adminUser?.name || '');
    setAdminEmail(bp?.spec?.adminUser?.email || '');
    setPlanKey(bp?.spec?.defaultPlanKey || '');
    setPreflight(null);
    setResult(null);
    setErr(null);
  };

  const setInput = (k, v) => { setInputs((p) => ({ ...p, [k]: v })); setPreflight(null); };

  const requiredFilled = specInputs.filter((i) => i.required)
    .every((i) => (inputs[i.key] || '').trim() !== '');

  const runPreflight = async () => {
    setErr(null); setBusy(true); setPreflight(null);
    try {
      const pf = await api.post('/platform/provision/preflight', {
        blueprintKey: bpKey, inputs,
        admin: { name: adminName || undefined, email: adminEmail || undefined },
        planKey: planKey || undefined,
      });
      setPreflight(pf);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const idempotencySuffix = inputs.slug || inputs.customerName || bpKey;

  const provision = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await api.post('/platform/tenants', {
        blueprintKey: bpKey, inputs,
        admin: { name: adminName || undefined, email: adminEmail || undefined },
        planKey: planKey || undefined,
        idempotencyKey: `wiz-${bpKey}-${idempotencySuffix}`,
      });
      setResult(r);
      setStep(4);
      onProvisioned?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const reset = () => {
    setStep(0); setBpKey(''); setInputs({}); setAdminName(''); setAdminEmail('');
    setPlanKey(''); setPreflight(null); setResult(null); setErr(null); setCopied(false);
  };

  const copyLink = async (link) => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* ignore */ }
  };

  // Per-step Next gate
  const canNext =
    step === 0 ? !!bpKey :
    step === 1 ? requiredFilled :
    step === 2 ? true :
    false;

  const go = (n) => { setErr(null); setStep(n); };

  // entering Review → auto preflight
  React.useEffect(() => { if (step === 3 && !preflight && !busy) runPreflight(); /* eslint-disable-next-line */ }, [step]);

  return (
    <div style={card}>
      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }} data-testid="wizard-steps">
        {STEPS.map((s, i) => (
          <span key={s} style={stepChip(i === step, i < step)}>{i + 1}. {s}</span>
        ))}
      </div>

      {err && <div style={{ ...errBar, marginBottom: 12 }} data-testid="wizard-err"><Icon name="flash" size={13} /> {err}</div>}

      {/* Step 0 — Template */}
      {step === 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={fieldLabel}>
            Blueprint
            <select value={bpKey} onChange={(e) => chooseBp(e.target.value)} style={selectStyle} data-testid="wiz-bp">
              <option value="">— select a blueprint —</option>
              {sortedBps.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name} ({b.key}) · v{b.version}{b.status !== 'PUBLISHED' ? ` [${b.status}]` : ''}
                </option>
              ))}
            </select>
          </label>
          {selectedBp && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              Template: <strong>{selectedBp.name}</strong> · status {selectedBp.status}
            </div>
          )}
        </div>
      )}

      {/* Step 1 — Customer */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {specInputs.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>This blueprint defines no inputs.</div>}
          {specInputs.map((inp) => {
            const htmlType = inp.type === 'number' ? 'number' : inp.type === 'email' ? 'email' : 'text';
            return (
              <label key={inp.key} style={fieldLabel}>
                {inp.label}{inp.required && <span style={{ color: 'var(--status-red, #e05)', marginLeft: 2 }}>*</span>}
                <input type={htmlType} value={inputs[inp.key] || ''} placeholder={inp.default != null ? String(inp.default) : ''}
                  onChange={(e) => setInput(inp.key, e.target.value)} style={inputStyle} data-testid={`wiz-input-${inp.key}`} />
              </label>
            );
          })}
        </div>
      )}

      {/* Step 2 — Admin & plan */}
      {step === 2 && (
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={fieldLabel}>Admin name
            <input type="text" value={adminName} onChange={(e) => { setAdminName(e.target.value); setPreflight(null); }} style={inputStyle} data-testid="wiz-admin-name" />
          </label>
          <label style={fieldLabel}>Admin email
            <input type="email" value={adminEmail} onChange={(e) => { setAdminEmail(e.target.value); setPreflight(null); }} style={inputStyle} data-testid="wiz-admin-email" />
          </label>
          <label style={fieldLabel}>Plan
            <select value={planKey} onChange={(e) => { setPlanKey(e.target.value); setPreflight(null); }} style={selectStyle} data-testid="wiz-plan">
              <option value="">— blueprint default —</option>
              {plans.map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
            </select>
          </label>
        </div>
      )}

      {/* Step 3 — Review */}
      {step === 3 && (
        <div style={{ display: 'grid', gap: 12 }} data-testid="wiz-review">
          {busy && <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Validating…</div>}
          {preflight && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>Slug</strong> <code style={codeChip}>{preflight.slug}</code>
                <span style={preflight.slugAvailable ? okPill : badPill}>{preflight.slugAvailable ? 'available' : 'taken'}</span>
                <strong style={{ marginLeft: 12 }}>Plan</strong> <code style={codeChip}>{preflight.resolvedPlanKey}</code>
                <strong style={{ marginLeft: 12 }}>Admin</strong> <span style={{ fontSize: 12 }}>{preflight.adminEmail}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)' }} data-testid="wiz-summary">
                {Object.entries(preflight.summary).map(([k, v]) => (
                  <span key={k}><strong>{v}</strong> {k}</span>
                ))}
              </div>
              {preflight.issues.length > 0 && (
                <div style={{ display: 'grid', gap: 6 }}>
                  {preflight.issues.map((iss, i) => (
                    <div key={i} style={iss.level === 'error' ? issueErr : issueWarn}>{iss.level}: {iss.message}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && result && (
        <div style={{ display: 'grid', gap: 12 }} data-testid="wiz-done">
          <div style={successBar}><strong>Provisioned:</strong> <code style={codeChip}>{result.slug}</code></div>
          {result.adminLoginOrInviteLink && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <a href={result.adminLoginOrInviteLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #0070f3)' }} data-testid="wiz-link">Admin invite link</a>
              <button style={miniBtn} onClick={() => copyLink(result.adminLoginOrInviteLink)}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
          <div><button style={primaryBtn} onClick={reset}>Provision another</button></div>
        </div>
      )}

      {/* Nav */}
      {step < 4 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {step > 0 && <button style={miniBtn} onClick={() => go(step - 1)} data-testid="wiz-back">Back</button>}
          {step < 3 && <button style={canNext ? primaryBtn : disabledBtn} disabled={!canNext} onClick={() => go(step + 1)} data-testid="wiz-next">Next</button>}
          {step === 3 && (
            <button style={preflight?.ok && !busy ? primaryBtn : disabledBtn} disabled={!preflight?.ok || busy} onClick={provision} data-testid="wiz-provision">
              {busy ? 'Provisioning…' : 'Provision'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const card = { background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' };
const codeChip = { fontFamily: 'var(--mono)', fontSize: 11, padding: '1px 6px', border: '1px solid var(--border-strong, #333)', borderRadius: 3, color: 'var(--text-secondary)' };
const fieldLabel = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 };
const selectStyle = { fontSize: 13, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', cursor: 'pointer', marginTop: 2 };
const inputStyle = { fontSize: 13, padding: '5px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-primary)', marginTop: 2 };
const primaryBtn = { fontSize: 13, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--accent, #0070f3)', background: 'var(--accent, #0070f3)', color: '#fff', cursor: 'pointer', fontWeight: 500 };
const disabledBtn = { fontSize: 13, padding: '5px 14px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--text-tertiary)', cursor: 'not-allowed', fontWeight: 500 };
const miniBtn = { fontSize: 12, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-secondary)', cursor: 'pointer' };
const errBar = { padding: '8px 12px', borderRadius: 6, background: 'var(--bg-muted)', border: '1px solid var(--status-red, #e05)', color: 'var(--status-red, #e05)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' };
const successBar = { padding: '8px 12px', borderRadius: 6, background: 'rgba(0,160,80,0.08)', border: '1px solid rgba(0,160,80,0.25)', color: 'var(--status-green, #0a0)', fontSize: 13 };
const okPill = { fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,160,80,0.12)', color: 'var(--status-green, #0a0)', border: '1px solid rgba(0,160,80,0.25)' };
const badPill = { fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(224,0,85,0.1)', color: 'var(--status-red, #e05)', border: '1px solid rgba(224,0,85,0.25)' };
const issueErr = { fontSize: 12, padding: '6px 10px', borderRadius: 5, background: 'rgba(224,0,85,0.08)', border: '1px solid rgba(224,0,85,0.25)', color: 'var(--status-red, #e05)' };
const issueWarn = { fontSize: 12, padding: '6px 10px', borderRadius: 5, background: 'rgba(220,150,0,0.08)', border: '1px solid rgba(220,150,0,0.3)', color: 'var(--status-amber, #b80)' };
const stepChip = (active, done) => ({
  fontSize: 11, padding: '2px 8px', borderRadius: 12,
  background: active ? 'var(--accent, #0070f3)' : done ? 'rgba(0,112,243,0.12)' : 'var(--bg)',
  color: active ? '#fff' : done ? 'var(--accent, #0070f3)' : 'var(--text-tertiary)',
  border: `1px solid ${active || done ? 'rgba(0,112,243,0.4)' : 'var(--border)'}`,
});
```

- [ ] **Step 2: Build the app**

Run: `cd app && npm run build`
Expected: build succeeds, no syntax/import errors.

- [ ] **Step 3: Commit**

```bash
git add app/src/provision_wizard.jsx
git commit -m "S4 Task 4: guided provisioning wizard component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Mount the wizard + Playwright journey

**Files:**
- Modify: `app/src/admin_platform.jsx` (replace the flat "Provision new customer" `<section>` with `<ProvisionWizard onProvisioned={reload} />`; remove now-dead provision-form state/handlers)
- Test: `tests/ui/setup-wizard.spec.mjs` (new)

**Interfaces:**
- Consumes: `ProvisionWizard` from `./provision_wizard.jsx`.

- [ ] **Step 1: Replace the flat form in `admin_platform.jsx`**

Add the import at the top: `import { ProvisionWizard } from './provision_wizard.jsx';`

Replace the entire "Provision new customer" `<section>` (the block from `<section>` containing `<SectionHead icon="plus" label="Provision new customer" />` through its closing `</section>`) with:
```jsx
          {/* ── Provision new customer (guided wizard, S4) ── */}
          <section>
            <SectionHead icon="plus" label="Provision new customer" />
            <ProvisionWizard onProvisioned={reload} />
          </section>
```
Then remove the now-unused provision-form state and handler that the flat form used: the `bpKey`/`inputs`/`result`/`lastResult`/`provisioning` state declarations, `selectedBp`/`specInputs` derived vars, `handleBpChange`, `handleInputChange`, `requiredFilled`, `canSubmit`, `idempotencySuffix`, and the `provision` function (lines ~14-19, ~40-89). Keep `tenants`, `blueprints`, `plans`, `err`, `reload`, `setStatus`, `changePlan`, and ALL blueprint-management state/handlers (capture/import/export/status). Keep `sortedBlueprints` (still used by the Blueprints section).

- [ ] **Step 2: Build to confirm no dangling references**

Run: `cd app && npm run build`
Expected: build succeeds (no references to removed vars).

- [ ] **Step 3: Write the Playwright journey**

Create `tests/ui/setup-wizard.spec.mjs` mirroring the conventions in `tests/ui/control-plane.spec.mjs` (same login helper / baseURL / platform-admin account). The journey, against the seeded `dlpe-demo` blueprint with a unique customer name:
```js
// Drive: login as platform admin → Control plane → wizard
//  Step Template: select 'dlpe-demo' in [data-testid=wiz-bp]
//  Next → Step Customer: fill required [data-testid=wiz-input-*]; set slug input to a unique value e.g. `wiz-e2e-${run}`
//  Next → Step Admin & plan: set wiz-admin-email to `e2e@wiz.test`, wiz-plan to 'pro'
//  Next → Step Review: expect [data-testid=wiz-summary] visible and slug 'available' pill
//  Click [data-testid=wiz-provision] → expect [data-testid=wiz-done] and [data-testid=wiz-link] visible
// Cleanup: delete the provisioned tenant via the same FK-safe order using a PrismaClient on TEST_DB_URL
//  (import { PrismaClient }; destroyTenant() copied from provision-wizard.test.mjs), keyed by the unique slug.
```
Use a run-unique slug (read from an env var or a fixed-per-file constant like `wiz-e2e-1`) so re-runs don't collide; if the slug exists from a prior aborted run, delete it in a `beforeAll`. Assert the done screen + invite link.

- [ ] **Step 4: Run the Playwright spec**

Run: `npx playwright test tests/ui/setup-wizard.spec.mjs`
Expected: PASS (wizard completes, tenant provisioned + cleaned up).

- [ ] **Step 5: Full regression — API suite twice + app build**

Run: `node tests/prepare-db.mjs && npx vitest run tests/api && npx vitest run tests/api && cd app && npm run build`
Expected: API green both runs; app builds.

- [ ] **Step 6: Commit**

```bash
git add app/src/admin_platform.jsx tests/ui/setup-wizard.spec.mjs
git commit -m "S4 Task 5: mount wizard in control plane + e2e journey

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
