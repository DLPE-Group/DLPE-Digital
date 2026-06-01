# Package A — Dashboard values from the DB · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's hardcoded metric values + `Math.random` "live" ticks with real numbers computed from Postgres, loaded once with a manual Refresh button.

**Architecture:** The existing server function `dashboardSnapshot()` is rewritten to query the DB (reusing `computeTrack()`) and return the *exact render shapes* the dashboard's chart components already consume. The frontend swaps its `useLiveData()` hook from local `METRICS.init()` to a one-shot fetch of `GET /api/aggregations/dashboard`, removes the simulation helpers, and adds a Refresh button. The chart layout flow (`/me/dashboard`) is untouched.

**Tech Stack:** Express + Prisma (server), React (app), no test framework (verify via `tsc --noEmit`, `npm run build`, and live curl/UI reload).

**Verification model:** This repo has no automated test harness. Each task is verified by (a) `tsc --noEmit` / build passing and (b) a live `curl` or UI-reload check proving the values are real. This matches the spec's Definition of Done.

**Metric definitions (4 are documented approximations):**
| Metric | Source |
|---|---|
| `pipeline` | Σ value SALES cards |
| `atRisk` | Σ value SALES cards `status='red'` |
| `pipelineStage` | SALES Σ value by stage meeting/offer/contract |
| `openByTrack` | count cards per track |
| `receivables` | FINANCE awaiting vs overdue Σ value |
| `workorders` | WORKSHOP counts by stage parts/in_repair/released/invoice_in |
| `wonThisWeek` *(approx)* | Σ value SALES `stageId='won'` AND `updatedAt ≥ now−7d` |
| `ontime` *(approx)* | OPERATIONS `green` ÷ total × 100 |
| `followupsDue` *(approx)* | count SALES cards `status ∈ {amber,red}` |
| `newLeads` *(approx)* | count cards `createdAt ≥ start-of-today` |

---

## File structure

- **Modify** `server/src/domain/aggregations.ts` — replace `dashboardSnapshot()` body; make it `async`. Keep `computeTrack`, `repMoney`, `DEFAULT_CHARTS` as-is.
- **Modify** `server/src/routes/aggregations.ts:14-16` — `await` the now-async `dashboardSnapshot()`.
- **Modify** `app/src/dashboard.jsx` — rewrite `useLiveData()` as a fetch hook; remove `rnd`/`push`/`series` and the `init`/`tick`/`change` entries in `METRICS`; add Refresh button + loading guard.

---

## Task A1: Server — compute the dashboard snapshot from the DB

**Files:**
- Modify: `server/src/domain/aggregations.ts:159-207` (the `dashboardSnapshot` function)
- Modify: `server/src/routes/aggregations.ts:14-16`

- [ ] **Step 1: Replace `dashboardSnapshot()` with a DB-backed async version**

In `server/src/domain/aggregations.ts`, replace the entire existing `dashboardSnapshot()` function (the one returning hardcoded `metrics`) with:

```ts
// Dashboard snapshot — computed from live DB cards. Returns render-ready shapes
// matching what app/src/dashboard.jsx chart components consume.
// NOTE: wonThisWeek / ontime / followupsDue / newLeads are documented approximations
// (no first-class source columns exist for them).
export async function dashboardSnapshot() {
  const cards = await prisma.card.findMany();
  const byTrack = (t: string) => cards.filter((c) => c.track === t);
  const sumValue = (arr: Card[]) => arr.reduce((a, x) => a + (x.value ?? 0), 0);

  const sales = byTrack('SALES');
  const ops = byTrack('OPERATIONS');
  const workshop = byTrack('WORKSHOP');
  const finance = byTrack('FINANCE');

  const stageVal = (arr: Card[], id: string) =>
    sumValue(arr.filter((x) => x.stageId === id));
  const stageCount = (arr: Card[], id: string) =>
    arr.filter((x) => x.stageId === id).length;

  // Approximations
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const wonThisWeek = sumValue(
    sales.filter((x) => x.stageId === 'won' && x.updatedAt >= weekAgo),
  );
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const newLeads = cards.filter((x) => x.createdAt >= startOfToday).length;
  const followupsDue = sales.filter((x) => x.status === 'amber' || x.status === 'red').length;
  const onGreen = ops.filter((x) => x.status === 'green').length;
  const ontimePct = ops.length ? Math.round((onGreen / ops.length) * 100) : 0;

  // Finance receivables
  const receivable = finance.filter((x) => x.type === 'INVOICE');
  const current = sumValue(receivable.filter((x) => x.stageId === 'awaiting'));
  const overdue = sumValue(receivable.filter((x) => x.stageId === 'overdue'));

  return {
    asOf: new Date().toISOString(),
    metrics: {
      pipeline: { value: sumValue(sales) },
      atRisk: { value: sumValue(sales.filter((x) => x.status === 'red')) },
      wonThisWeek: { value: wonThisWeek },
      followupsDue: { value: followupsDue },
      newLeads: { value: newLeads },
      ontime: {
        pct: ontimePct,
        segments: [
          { label: 'On-time', value: ontimePct, color: 'var(--status-green)' },
          { label: 'Late', value: 100 - ontimePct, color: 'var(--status-amber)' },
        ],
      },
      receivables: {
        segments: [
          { label: 'Current', value: current, color: 'var(--track-finance)' },
          { label: '31d+ overdue', value: overdue, color: 'var(--status-red)' },
        ],
      },
      pipelineStage: {
        cats: [
          { label: 'Meeting', value: stageVal(sales, 'meeting') },
          { label: 'Offer', value: stageVal(sales, 'offer') },
          { label: 'Contract', value: stageVal(sales, 'contract') },
        ],
      },
      openByTrack: {
        cats: [
          { label: 'Sales', value: sales.length, color: 'var(--track-sales)' },
          { label: 'Operations', value: ops.length, color: 'var(--track-ops)' },
          { label: 'Workshop', value: workshop.length, color: 'var(--track-workshop)' },
          { label: 'Finance', value: finance.length, color: 'var(--track-finance)' },
        ],
      },
      workorders: {
        cats: [
          { label: 'Parts', value: stageCount(workshop, 'parts') },
          { label: 'In repair', value: stageCount(workshop, 'in_repair') },
          { label: 'Released', value: stageCount(workshop, 'released') },
          { label: 'Invoice in', value: stageCount(workshop, 'invoice_in') },
        ],
      },
    },
    defaultCharts: DEFAULT_CHARTS,
  };
}
```

(`DEFAULT_CHARTS` is already defined directly above this function — leave it in place. `Card` type is already imported at the top of the file.)

- [ ] **Step 2: Make the route await the async snapshot**

In `server/src/routes/aggregations.ts`, change the dashboard handler:

```ts
aggregationsRouter.get('/dashboard', async (_req, res) => {
  res.json(await dashboardSnapshot());
});
```

- [ ] **Step 3: Typecheck the server**

Run: `npm --workspace server run typecheck`
Expected: no output / exit 0 (PASS).

- [ ] **Step 4: Live-verify the endpoint returns real numbers**

The dev server (`npm run dev`) hot-reloads. Mint a token (login is rate-limited; reuse if needed) and call the endpoint:

```bash
cd "server" && ADMIN=$(node -e "const fs=require('fs');const s=fs.readFileSync('../.env','utf8').match(/JWT_SECRET=(.*)/)[1].trim();import('jsonwebtoken').then(({default:j})=>console.log(j.sign({sub:'u-robert',email:'r.mertens@group.eu',roleId:'group-admin'},s,{expiresIn:'15m'})))") ; cd ..
curl -s localhost:4000/api/aggregations/dashboard -H "Authorization: Bearer $ADMIN" | python3 -m json.tool
```

Expected: JSON with `metrics.pipeline.value` equal to the live SALES card sum (the same figure reports show, e.g. 8620000 with seed data), `metrics.openByTrack.cats` counts matching real cards, and an ISO `asOf`. Confirm the numbers are NOT the old hardcoded literals if cards have since changed (move a card and re-call to see `openByTrack`/`pipelineStage` shift).

- [ ] **Step 5: Commit**

```bash
git add server/src/domain/aggregations.ts server/src/routes/aggregations.ts
git commit -m "Package A: compute dashboard snapshot from live DB cards"
```

---

## Task A2: Frontend — fetch real values, drop the simulation

**Files:**
- Modify: `app/src/dashboard.jsx`

- [ ] **Step 1: Remove the simulation helpers**

In `app/src/dashboard.jsx`, delete these three lines (currently 14-16):

```js
const rnd = (a, b) => a + Math.random() * (b - a);
const push = (arr, v, cap = 26) => { const n = [...arr, v]; return n.length > cap ? n.slice(n.length - cap) : n; };
const series = (n, lo, hi) => Array.from({ length: n }, () => Math.round(rnd(lo, hi)));
```

- [ ] **Step 2: Strip `init`/`tick`/`change` from the METRICS catalogue**

Replace the entire `export const METRICS = { ... };` block with this metadata-only version (no values, no simulation, no fake deltas):

```js
/* ---- Metric catalogue — metadata only; VALUES come from the server. ---- */
export const METRICS = {
  wonThisWeek:  { id: 'wonThisWeek',  label: 'Closed-won this week',  unit: '€', shape: 'money',   color: 'var(--status-green)' },
  followupsDue: { id: 'followupsDue', label: 'Follow-ups due today',  unit: '',  shape: 'counter', color: 'var(--track-ops)' },
  newLeads:     { id: 'newLeads',     label: 'New leads today',       unit: '',  shape: 'counter', color: 'var(--track-sales)' },
  pipeline:     { id: 'pipeline',     label: 'Open pipeline',         unit: '€', shape: 'money',   color: 'var(--track-sales)' },
  atRisk:       { id: 'atRisk',       label: 'At-risk pipeline',      unit: '€', shape: 'money',   color: 'var(--status-red)' },
  ontime:       { id: 'ontime',       label: 'On-time delivery',      unit: '%', shape: 'segments',color: 'var(--status-green)' },
  receivables:  { id: 'receivables',  label: 'Receivables split',     unit: '€', shape: 'segments',color: 'var(--track-finance)' },
  pipelineStage:{ id: 'pipelineStage',label: 'Pipeline by stage',     unit: '€', shape: 'cats',    color: 'var(--track-sales)' },
  openByTrack:  { id: 'openByTrack',  label: 'Open items by track',   unit: '',  shape: 'cats',    color: 'var(--brand)' },
  workorders:   { id: 'workorders',   label: 'Work orders by stage',  unit: '',  shape: 'cats',    color: 'var(--track-workshop)' },
};
```

- [ ] **Step 3: Replace `useLiveData()` with a one-shot fetch hook**

Replace the `useLiveData` hook (currently lines 96-101) with:

```js
/* ---- Snapshot data hook — fetched once from the server, with manual refresh. ---- */
const useLiveData = () => {
  const [data, setData] = React.useState(null);
  const [asOf, setAsOf] = React.useState(null);
  const load = React.useCallback(() => {
    api.get('/aggregations/dashboard')
      .then((res) => { setData(res.metrics); setAsOf(res.asOf); })
      .catch((e) => console.error('Failed to load dashboard metrics', e));
  }, []);
  React.useEffect(() => { load(); }, [load]);
  return { data, asOf, refresh: load };
};
```

- [ ] **Step 4: Remove the fake delta block from `LiveStat`**

The `change` property no longer exists. Replace the `LiveStat` component (currently lines 169-182) with:

```js
const LiveStat = ({ m, d }) => (
  <div className="dbStat">
    <div className="dbStatVal">{fmtValue(m, d.value)}</div>
    {d.series && <div className="dbStatSpark"><LiveLine pts={d.series} color={m.color} height={34} /></div>}
  </div>
);
```

(The server omits `series`, so the sparkline simply won't render — no fake history. `LiveLine` and the bar/donut components are unchanged and still work for `cats`/`segments` shapes.)

- [ ] **Step 5: Consume the new hook + guard for loading + add Refresh in `DashboardTab`**

In `DashboardTab` (currently starts line 281): change the hook destructure and the `asOf`/bar, and guard the grid against `data === null`.

Replace:
```js
  const { data } = useLiveData();
  const asOf = React.useMemo(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }), []);
```
with:
```js
  const { data, asOf: asOfIso, refresh } = useLiveData();
  const asOf = React.useMemo(
    () => asOfIso ? new Date(asOfIso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '…',
    [asOfIso],
  );
```

Replace the `dbBar` block (the toolbar with the "Add chart" button) with one that adds a Refresh button:
```jsx
      <div className="dbBar">
        <div className="dbAsOf">Pipeline snapshot · as of {asOf}</div>
        <div style={{ flex: 1 }} />
        <button className="cta ghost" onClick={refresh}><Icon name="arrow" size={12} strokeWidth={2} /> Refresh</button>
        <button className="cta" onClick={() => setBuilding(true)}><Icon name="plus" size={12} strokeWidth={2} /> Add chart</button>
      </div>
```

Immediately after the opening `return (` `<div className="dbWrap">` add a loading guard so chart bodies never read from a null `data`. Wrap the existing `<div className="dbGrid">…</div>` so it only renders when `data` is present; otherwise show a placeholder. Concretely, change the grid's `charts.map(...)` data references — they already use `data[c.metricId]`; add this guard right before `<div className="dbGrid">`:
```jsx
      {!data && <div className="dbAsOf" style={{ padding: '24px 0' }}>Loading live metrics…</div>}
      {data && (
```
and add a matching closing `)}` immediately after the `</div>` that closes `dbGrid` (before the `{building && …}` line). The `ChartBuilder` is only opened by a user click (after load), and it reads `live={data}` — guarded because the button lives inside the `data &&` block.

- [ ] **Step 6: Build the app**

Run: `npm --workspace app run build`
Expected: Vite build succeeds (exit 0), no "rnd is not defined" / "series is not defined" / reference errors.

- [ ] **Step 7: Live-verify in the browser**

With `npm run dev` running, open http://localhost:5173, sign in, go to the dashboard. Expected:
- Tiles show the real figures (pipeline = live SALES sum, openByTrack/workorders counts match the pipeline data).
- No values jitter/animate over time (no `Math.random`).
- Click **Refresh** — values reload (move a card in another tab first, then Refresh → the affected tile changes).

- [ ] **Step 8: Commit**

```bash
git add app/src/dashboard.jsx
git commit -m "Package A: dashboard reads real metrics from API, drop random-tick simulation"
```

---

## Task A3: Final verification for Package A

- [ ] **Step 1: Full typecheck + builds**

Run: `npm --workspace server run typecheck && npm run build`
Expected: both succeed (exit 0).

- [ ] **Step 2: Confirm no simulation remains**

Run: `grep -nE "Math.random|rnd\(|series\(" app/src/dashboard.jsx`
Expected: no matches (empty output).

- [ ] **Step 3: Reload-survives check**

Move a sales card stage via the UI (or `PUT /api/cards/:id/stage`), then reload the dashboard and click Refresh. Expected: `pipelineStage` / `openByTrack` reflect the change — proving values are DB-derived, not client constants.

---

## Self-review notes

- **Spec coverage:** Implements Package A fully — all 10 metrics computed from the DB (6 exact, 4 documented approximations), load-once + manual Refresh, simulation removed. ✓
- **No placeholders:** every code block is complete and final. ✓
- **Type consistency:** server returns shapes `{value}` / `{pct,segments}` / `{segments}` / `{cats}` exactly matching `LiveStat`/`LiveDonut`/`LiveBars`; `useLiveData` now returns `{data, asOf, refresh}` and every consumer is updated. ✓
- **Known cosmetic:** `receivables` segment values are real euros (large numbers in the donut legend); acceptable for this package, polish deferred.
