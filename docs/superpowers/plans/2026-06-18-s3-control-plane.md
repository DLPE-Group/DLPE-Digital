# S3 — Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A platform-admin-only UI to list tenants, provision a new customer from a blueprint, and suspend/reactivate tenants — the first visible payoff of S0+S1.

**Architecture:** Small backend additions to S1's `/api/platform/*` (expose `platformAdmin` on `/me/permissions`; add `PATCH /platform/tenants/:id` status) + a React `ControlPlaneView` gated by a new `isPlatformAdmin` flag, following the existing `DataModelView` pattern. Demo grants `r.mertens` platform-admin so it's reachable.

**Tech Stack:** Express + Prisma 6, Vite + React (app/src), Vitest API suite, Playwright UI journeys.

## Global Constraints
- Builds on S0+S1 (merged to main). Branch: `feature/s3-control-plane` (off main). Platform routes already sit behind `requireAuth` → `tenantContext` → `requirePlatformAdmin` (`server/src/index.ts`). Platform ops use the owner `prisma` (bypass RLS).
- **Platform-admin is a SEPARATE, higher tier than tenant group-admin.** The control-plane nav/view is gated by `isPlatformAdmin` (`me.platformAdmin`), NOT the existing `isAdmin` (`roleId === 'group-admin'`).
- `TenantStatus` enum = `TRIAL | ACTIVE | SUSPENDED | ARCHIVED`. Demo tenant id `tenant-dlpe-demo`.
- Migrations via `prisma migrate deploy` only (never `migrate dev`/`reset`); test DB via `node tests/prepare-db.mjs`.
- Commit trailer ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Frontend code references files via existing patterns; new view mirrors `app/src/data_model.jsx` (reads with `api.get`, mutates with `api.post`/`api.patch`, `setErr` for inline errors, `reload()` after mutations).

## File Structure
- `server/src/routes/permissions.ts` — add `platformAdmin` to the `/me/permissions` response.
- `server/src/routes/platform.ts` — add `PATCH /tenants/:id` (status).
- `packages/shared/blueprint.ts` — add optional `platformAdmin?: boolean` to `UserSpec`.
- `server/src/domain/provisioning/provisionTenant.ts` — interpreter sets `platformAdmin` on created users when present.
- `server/src/domain/provisioning/dlpeDemoBlueprint.ts` — set `platformAdmin: true` on the `r.mertens` user.
- `app/src/admin_platform.jsx` — **new** `ControlPlaneView`.
- `app/src/App.jsx` — surface `isPlatformAdmin`; add `'platform'` view + render; gate.
- `app/src/side_menu.jsx` — add the "Control plane" item (platform-admin only).
- Tests: `tests/api/platform-control.test.mjs`, `tests/ui/control-plane.spec.mjs`.

---

### Task 1: Backend — platformAdmin on /me, PATCH tenant status, demo platform admin

**Files:**
- Modify: `server/src/routes/permissions.ts`, `server/src/routes/platform.ts`, `packages/shared/blueprint.ts`, `server/src/domain/provisioning/provisionTenant.ts`, `server/src/domain/provisioning/dlpeDemoBlueprint.ts`
- Test: `tests/api/platform-control.test.mjs`

**Interfaces:**
- Produces: `GET /me/permissions` includes `platformAdmin: boolean`; `PATCH /api/platform/tenants/:id` `{ status }` → updated Tenant (400 invalid status, 404 unknown id, 403 non-platform-admin); `UserSpec.platformAdmin?: boolean`; demo `r.mertens.platformAdmin === true`.

- [ ] **Step 1: Write the failing test**

```js
// tests/api/platform-control.test.mjs
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { get, patch, req, token, TEST_DB_URL } from '../helpers.mjs';
const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
const PLATFORM = () => token('u-robert', 'r.mertens@group.eu', 'group-admin');
const NON = () => token('u-markus', 'm.weber@group.eu', 'sales-mgr');
afterAll(() => prisma.$disconnect());

describe('control plane backend', () => {
  it('/me/permissions exposes platformAdmin (true for demo r.mertens)', async () => {
    const r = await get('/me/permissions', PLATFORM());
    expect(r.status).toBe(200);
    expect(r.body.platformAdmin).toBe(true);
  });
  it('PATCH /platform/tenants/:id flips status; guards', async () => {
    const susp = await patch('/platform/tenants/tenant-dlpe-demo', { status: 'SUSPENDED' }, PLATFORM());
    expect(susp.status).toBe(200); expect(susp.body.status).toBe('SUSPENDED');
    const back = await patch('/platform/tenants/tenant-dlpe-demo', { status: 'ACTIVE' }, PLATFORM());
    expect(back.body.status).toBe('ACTIVE');
    expect((await patch('/platform/tenants/tenant-dlpe-demo', { status: 'NOPE' }, PLATFORM())).status).toBe(400);
    expect((await patch('/platform/tenants/does-not-exist', { status: 'ACTIVE' }, PLATFORM())).status).toBe(404);
    expect((await req('PATCH', '/platform/tenants/tenant-dlpe-demo', { body: { status: 'ACTIVE' }, tok: NON() })).status).toBe(403);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/prepare-db.mjs && npm run test:api -- platform-control`
Expected: FAIL — `platformAdmin` absent on /me; PATCH route 404 (not implemented); demo robert not platform-admin.

- [ ] **Step 3: Implement the backend changes**

- `permissions.ts`: add `platformAdmin: req.user?.platformAdmin ?? false,` to the `res.json({...})` object.
- `platform.ts`: add
  ```ts
  import { z } from 'zod';
  const statusSchema = z.object({ status: z.enum(['TRIAL','ACTIVE','SUSPENDED','ARCHIVED']) });
  platformRouter.patch('/tenants/:id', async (req, res) => {
    const parsed = statusSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
    try {
      const t = await prisma.tenant.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
      res.json(t);
    } catch { return res.status(404).json({ error: 'Tenant not found' }); }
  });
  ```
  (Match the router's existing name/import style — it may be `platformRouter` or a local `router`; use whatever the file already exports.)
- `packages/shared/blueprint.ts` `UserSpec`: add `platformAdmin: z.boolean().optional(),`.
- `provisionTenant.ts`: where it creates `spec.users[]` users, include `platformAdmin: u.platformAdmin ?? false` in the create data.
- `dlpeDemoBlueprint.ts`: on the `r.mertens` user entry, add `platformAdmin: true`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tests/prepare-db.mjs && npm run test:api -- platform-control` + `cd server && npx tsc --noEmit`
Expected: PASS + zero TS errors.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm run test:api`
Expected: all green (was 103; now 103 + the new platform-control cases).

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/permissions.ts server/src/routes/platform.ts packages/shared/blueprint.ts server/src/domain/provisioning tests/api/platform-control.test.mjs
git commit -m "feat(control-plane): platformAdmin on /me, PATCH tenant status, demo platform admin

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — gating, side-menu item, Control Plane view (tenants + blueprints + suspend)

**Files:**
- Create: `app/src/admin_platform.jsx`
- Modify: `app/src/App.jsx`, `app/src/side_menu.jsx`
- Verify: `npm --workspace app run build`

**Interfaces:**
- Consumes: `GET /platform/tenants`, `GET /platform/blueprints`, `PATCH /platform/tenants/:id` (Task 1); `me.platformAdmin`.
- Produces: `ControlPlaneView` React component (default export `ControlPlaneView`); `App.jsx` renders it for `active === 'platform'`, gated by `isPlatformAdmin`; side menu shows "Control plane" when `isPlatformAdmin`.

- [ ] **Step 1: Create `app/src/admin_platform.jsx`**

Mirror `app/src/data_model.jsx` structure. Minimum:

```jsx
import React from 'react';
import { api } from './api/client.js';
import { Icon } from './icons.jsx';

export const ControlPlaneView = () => {
  const [tenants, setTenants] = React.useState(null);
  const [blueprints, setBlueprints] = React.useState([]);
  const [err, setErr] = React.useState(null);
  const reload = React.useCallback(() => {
    Promise.all([api.get('/platform/tenants'), api.get('/platform/blueprints')])
      .then(([t, b]) => { setTenants(t); setBlueprints(b); })
      .catch((e) => setErr(e.message));
  }, []);
  React.useEffect(() => { reload(); }, [reload]);

  const setStatus = async (id, status) => {
    setErr(null);
    try { await api.patch(`/platform/tenants/${id}`, { status }); reload(); }
    catch (e) { setErr(e.message); }
  };

  if (!tenants) return <div className="panel">Loading…</div>;
  return (
    <div className="panel">
      <h2>Control plane</h2>
      {err && <div className="error">{err}</div>}
      <h3>Tenants</h3>
      <table>
        <thead><tr><th>Name</th><th>Slug</th><th>Status</th><th>Region</th><th></th></tr></thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td><td>{t.slug}</td><td>{t.status}</td><td>{t.region}</td>
              <td>
                {t.status === 'ACTIVE'
                  ? <button onClick={() => setStatus(t.id, 'SUSPENDED')}>Suspend</button>
                  : <button onClick={() => setStatus(t.id, 'ACTIVE')}>Reactivate</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Blueprints</h3>
      <ul>{blueprints.map((b) => <li key={b.id}>{b.name} · {b.key} · v{b.version} · {b.status}</li>)}</ul>
    </div>
  );
};
```

(Use the app's existing className/markup conventions — match how `DataModelView` renders panels/tables/buttons rather than the bare markup above if the app has shared primitives in `primitives.jsx`.)

- [ ] **Step 2: Wire `App.jsx`**

- After `const isAdmin = me?.roleId === 'group-admin';` add `const isPlatformAdmin = !!me?.platformAdmin;`.
- Import: `import { ControlPlaneView } from './admin_platform.jsx';`.
- In the gating block, allow `'platform'` only when `isPlatformAdmin` (mirror the `ADMIN_ONLY_VIEWS` guard but against `isPlatformAdmin`): if `active === 'platform' && !isPlatformAdmin`, fall back to the default view.
- In the render switch, add `if (active === 'platform') return <ControlPlaneView />;`.
- Pass `isPlatformAdmin` to `<SideMenu ... isPlatformAdmin={isPlatformAdmin} />`.

- [ ] **Step 3: Wire `side_menu.jsx`**

- Add `isPlatformAdmin` to the `SideMenu` props.
- In the admin section, add (separate from the `isAdmin` items): `{isPlatformAdmin && item('platform', 'bolt', 'Control plane')}`.

- [ ] **Step 4: Verify the frontend builds**

Run: `npm --workspace app run build`
Expected: build succeeds (no TS/JSX errors, no missing imports).

- [ ] **Step 5: Commit**

```bash
git add app/src/admin_platform.jsx app/src/App.jsx app/src/side_menu.jsx
git commit -m "feat(control-plane): platform-admin Control Plane view (tenants + blueprints + suspend)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — "Provision new customer" form

**Files:**
- Modify: `app/src/admin_platform.jsx`
- Verify: `npm --workspace app run build`

**Interfaces:**
- Consumes: `GET /platform/blueprints` (to pick one + read its `spec.inputs`), `POST /platform/tenants` `{ blueprintKey, inputs, idempotencyKey }`.
- Produces: a form in `ControlPlaneView` that provisions a tenant and shows the returned `adminLoginOrInviteLink`.

- [ ] **Step 1: Add the provision form to `ControlPlaneView`**

Add state `const [bpKey, setBpKey] = React.useState('')`, `const [inputs, setInputs] = React.useState({})`, `const [result, setResult] = React.useState(null)`. When a blueprint is selected, read its `spec.inputs` (the blueprint list from `GET /platform/blueprints` includes `spec`) and render one labelled `<input>` per declared input (`key`, `label`, `type`). On submit:

```jsx
const provision = async (e) => {
  e.preventDefault();
  setErr(null); setResult(null);
  try {
    const r = await api.post('/platform/tenants', {
      blueprintKey: bpKey,
      inputs,
      idempotencyKey: `cp-${bpKey}-${inputs.slug || inputs.customerName || ''}`,
    });
    setResult(r); reload();
  } catch (e) { setErr(e.message); }
};
```

Render a `<select>` of blueprint keys, the dynamic inputs, a Provision button, and on success show `result.adminLoginOrInviteLink` + `result.slug`. Guard: disable submit until a blueprint + required inputs are filled.

- [ ] **Step 2: Verify the frontend builds**

Run: `npm --workspace app run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/src/admin_platform.jsx
git commit -m "feat(control-plane): provision-new-customer form (blueprint + dynamic inputs)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Playwright journey + final verification

**Files:**
- Create: `tests/ui/control-plane.spec.mjs`
- Verify: full API suite + frontend build

**Interfaces:**
- Consumes: the running app (Playwright harness mirrors the existing `tests/ui/journeys.spec.mjs` setup).

- [ ] **Step 1: Read the existing UI journey harness**

Read `tests/ui/journeys.spec.mjs` to copy its login helper, base URL, and setup conventions (do NOT invent a new harness).

- [ ] **Step 2: Write the journey**

`tests/ui/control-plane.spec.mjs`: log in as `r.mertens@group.eu` / `demo1234` (platform admin), navigate to the Control plane nav item, assert the demo tenant row is visible, click Suspend → assert status shows SUSPENDED, click Reactivate → assert ACTIVE. Follow the existing spec's selectors/wait patterns.

- [ ] **Step 3: Run the journey**

Run: `npm run test:ui -- control-plane` (ensure the app + API are running per the existing UI-test convention; if the harness auto-starts them, follow it).
Expected: PASS.

- [ ] **Step 4: Final verification**

Run: `node tests/prepare-db.mjs && npm run test:api` (all green) and `npm --workspace app run build` (succeeds).
Expected: full API suite green, frontend builds.

- [ ] **Step 5: Commit**

```bash
git add tests/ui/control-plane.spec.mjs
git commit -m "test(control-plane): Playwright journey — suspend/reactivate the demo tenant

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review
**Spec coverage:** list tenants (T2) ✅; provision from blueprint (T3) ✅; suspend/reactivate (T1 backend + T2 UI) ✅; list blueprints (T2) ✅; platformAdmin gating (T1 + T2) ✅; demo platform admin (T1) ✅; tests (T1 API + T4 journey) ✅. SUSPENDED login-enforcement correctly deferred to S9 per the spec.
**Placeholder scan:** no TBD/TODO; the JSX is illustrative and explicitly says to match the app's existing primitives/conventions — that's a styling instruction, not hidden logic.
**Type consistency:** `platformAdmin` flows `User`(S1) → `AuthUser`(S1) → `/me/permissions`(T1) → `me.platformAdmin`→`isPlatformAdmin`(T2). `PATCH /platform/tenants/:id {status}` (T1) consumed by `setStatus` (T2). `POST /platform/tenants {blueprintKey,inputs,idempotencyKey}` (S1) consumed by `provision` (T3).

## Notes for the implementer
- Frontend tasks verify via `npm --workspace app run build` (compile) + the Playwright journey (behavior) since the API suite can't exercise React. Keep the view consistent with the app's existing look (reuse `primitives.jsx`/classes used by `DataModelView`).
- If the platform router file uses a local `router` const rather than `platformRouter`, match it. Confirm the import of `prisma` already present in `platform.ts`.
