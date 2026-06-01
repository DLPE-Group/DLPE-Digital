# Design — "Make everything real": eliminate mock data & dead actions

**Date:** 2026-06-01
**Status:** Draft for review
**Goal:** Every interactive control in the app either persists to / reads from Postgres,
or is honestly removed. No hardcoded display values, no `Math.random` simulation, no
dead (no-op) buttons. Card actions, stage moves, RBAC, reports, and pipelines are already
real and are out of scope except where noted.

**Out of scope (explicit user decision):** Package **G** — Nango OAuth connect flow and the
AI field-mapping schema discovery stay *simulated* (no external Nango account / source
systems to introspect). They are untouched by this effort.

---

## Approach & sequencing

One spec, six packages, implemented **in dependency order with a review checkpoint
between each package**. Each package is independently shippable and verifiable.

```
A  Dashboard values → real        (no new models; rewrite one server fn + dashboard.jsx)
B  Wire dead admin buttons        (endpoints already exist; UI just isn't calling them)
C  New admin endpoints            (new routes + 1 schema column for RBAC version snapshots)
D  User preferences               (new model + /me/preferences; enforce where natural)
E  Expose already-seeded models   (Vehicles / Portal data exist in DB — add GET routes + wire UI)
F  Utility buttons & new features  (exports, notifications, portal messages, integration ops)
```

Verification after every package: `tsc --noEmit` (server + app build), plus a live
`curl`/UI check that the specific action now persists (reload-survives) or reads real data.

---

## Package A — Dashboard values from the DB

**Problem:** [dashboard.jsx](../../../app/src/dashboard.jsx) `METRICS` hardcodes every tile
(`pipeline: 8620000`, …) and animates with `Math.random` ticks. Only the *layout* is
persisted (`/me/dashboard`). The server `dashboardSnapshot()` is also hardcoded and unused.

**Backend:** Rewrite `dashboardSnapshot()` in
[aggregations.ts](../../../server/src/domain/aggregations.ts) to compute all tiles from the
DB, reusing `computeTrack()` where possible. Metric definitions:

| Metric | Definition (real source) |
|---|---|
| `pipeline` | Σ value of SALES cards |
| `atRisk` | Σ value of SALES cards `status='red'` |
| `pipelineStage` | SALES Σ value grouped by stage (meeting/offer/contract) |
| `openByTrack` | count of cards per track |
| `receivables` | FINANCE awaiting vs overdue Σ value |
| `workorders` | WORKSHOP counts by stage |
| `wonThisWeek` *(approx)* | Σ value of SALES cards `stageId='won'` AND `updatedAt ≥ now−7d` |
| `ontime` *(approx)* | OPERATIONS `green` ÷ total × 100 |
| `followupsDue` *(approx)* | count of SALES cards `status ∈ {amber,red}` |
| `newLeads` *(approx)* | count of cards `createdAt ≥ start-of-today` |

The 4 approximations are documented in code; `newLeads` will read 0 with seed data (all seeded
same day) until real activity occurs — acceptable and honest.

**Frontend:** `dashboard.jsx` fetches `GET /api/aggregations/dashboard` once on mount and on a
new **Refresh** button. Remove `METRICS[*].init/tick` value logic and the `series()`/`rnd()`
simulation; keep metric *metadata* (label, shape, color) for rendering. Sparklines: either drop,
or render a flat/real series (no random). Layout fetch/save (`/me/dashboard`) is unchanged.

**Decision (load behavior):** real numbers, **load once + manual refresh** (no polling, no
animation) — per earlier decision.

---

## Package B — Wire dead admin buttons to EXISTING endpoints

These endpoints already exist; the UI just doesn't call them.

| Action | File | Endpoint (exists) | Change |
|---|---|---|---|
| Node **rename** | admin_structure.jsx:286 | `PATCH /admin/structure/:id` | Add inline rename form → call API → update tree |
| Node **settings edit** + revert | admin_structure.jsx (SettingRow) | `PATCH /admin/structure/:id` (`settings`/`overrides`) | Add editable controls; wire **Save changes** (352) + revert buttons |
| **Secondary scopes** add/remove | admin_users.jsx | `POST/DELETE /admin/users/:id/scopes` | Call API on add/remove (currently local-state only) |
| **Discard changes** reload | editors.jsx:185 | `GET /admin/stage-config` | Re-fetch from server instead of just clearing dirty flag |

No schema changes. Verification: edit → reload → persists.

---

## Package C — New admin endpoints

| Action | New endpoint | Notes |
|---|---|---|
| **New role** | `POST /admin/roles` | Create `Role` row; admin_rbac "New role" (70) opens a form |
| **Clone role** | `POST /admin/roles/:id/clone` | Copy role + duplicate its `FieldRule` rows under the new id |
| **RBAC version revert** | `POST /admin/rbac/versions/:v/revert` | Re-apply that version's field-rule snapshot |

**Schema change (required for real revert):** `RbacVersion` currently stores only
`{v, when, actor, note}` — **no rule snapshot**, so revert is impossible today. Add a
`snapshot Json` column; populate it on every `PUT /field-rules` with the full effective
`FieldRule` set at save time. Revert writes that snapshot back transactionally and creates a
new version ("Reverted to v{n}"). Migration required.

---

## Package D — User preferences (Settings toggles)

**Problem:** 6 toggles in [views_part2.jsx](../../../app/src/views_part2.jsx) (enforce stage
locks, PEPPOL preferred, email/Slack notifications, daily digest, auto-escalate) are
local-state only and lost on reload.

**Backend:** New model `UserPreference { userId @unique, prefs Json, updatedAt }` +
`GET/PUT /me/preferences`. Migration required.

**Enforcement (honest scoping):**
- `enforceLocks` → **actually enforced**: `moveStage()` rejects a move out of a locked stage
  when the user's pref is on (returns 4xx; UI shows the lock).
- `peppolPreferred` → **honored** as the default delivery channel in the invoice action flow.
- `email/slack notifications`, `dailyDigest`, `autoEscalate` → **persisted only**. There is no
  email/Slack delivery backend or scheduler in this app, so these store the preference but do
  not yet trigger external delivery. Flagged so this isn't mistaken for a delivery feature.

---

## Package E — Expose already-seeded data (Vehicles & Portal)

**Discovery:** `Vehicle`, `Invoice`, `FleetOperator`, `VehicleTimeline`, `TimelineEvent`
models **exist and are already seeded** (Vehicle:4, Invoice:2, …). The frontend just reads
seed constants (`VEHICLE_DATA`, `PORTAL_FLEET`) instead of fetching them.

| Action | New endpoint | Frontend change |
|---|---|---|
| Vehicles list + filters + search | `GET /vehicles` (query: status, q) | views_part2 VehiclesView fetches it |
| Vehicle timeline | `GET /vehicles/:id/timeline` | timeline.jsx uses real events |
| Customer portal (fleet/invoices/messages) | `GET /portal` (scoped to caller's operator) | portal.jsx fetches it |

**Weaker sub-items (no clean real source — flagged for review):**
- Reports **"records synced · last 7 days"** trend ([reports.jsx](../../../app/src/reports.jsx)
  `TREND`) — no sync history exists. Proposal: derive a real per-day count from `AuditEntry`
  timestamps (records changed/day). If rejected, remove the chart.
- Integration **health metrics** (throughput/latency) — no real telemetry. Proposal: derive
  `lastSync` from `Integration.updatedAt`; show throughput/latency as "—" rather than fake
  strings, or compute a coarse count from audit activity.

---

## Package F — Utility buttons & small new features

| Action | Approach | New backend |
|---|---|---|
| **Export CSV/JSON** (audit, structure, settings) | Server generates from real rows | `GET /audit/export.csv`, `GET /admin/structure/export.json`, `GET /me/settings/export.json` |
| **Notifications** (bell) | New `Notification` model; generated on system events (cascades, overdue) | `GET /notifications`, `POST /notifications/:id/read` |
| **Portal: message account team** | Persist a message | New `PortalMessage` model; `POST /portal/messages`, `GET /portal/messages` |
| **Portal: fleet report** | Reuse report generation scoped to the operator | (reuse `POST /reports`) |
| **Integration test / logs / config** | test pings + bumps `lastSync`; logs from audit-derived events; config views/edits the row | `POST /integrations/:id/test`, `GET /integrations/:id/logs`, `PATCH /integrations/:id` |
| **Bulk CSV import (users)** | Parse CSV → create users | `POST /admin/users/import` |
| **Add track** | ⚠️ `Track` is a fixed enum (SALES/OPS/WORKSHOP/FINANCE). A dynamic track is a deep schema change out of proportion to the rest. **Proposal: remove the button** (or convert to a disabled "coming soon"). | none |

**Flagged decisions for review:** notification *generation* triggers (which events create a
notification), integration *logs* source (audit-derived vs a new `IntegrationLog` model), and
the **Add track** removal.

---

## Models added (summary)

- `UserPreference` (D)
- `Notification` (F)
- `PortalMessage` (F)
- `RbacVersion.snapshot Json` column (C)
- *(optional)* `IntegrationLog` (F, if logs aren't audit-derived)

Each is a Prisma migration; `db:migrate` + a seed top-up where demo data helps.

---

## Risks & honest limitations

1. **Approximated metrics** (A) and **derived trend/health** (E) are real-data-driven but are
   proxies, not first-class measures. Documented in code.
2. **Notification/email/Slack delivery** (D, F) is *not* built — preferences persist and
   in-app notifications are generated, but nothing is emailed/posted externally.
3. **Add track** (F) is intentionally dropped rather than faked.
4. Package G (Nango/AI-mapping) remains simulated by your decision.

## Definition of done

- No `Math.random`-driven display values remain in `dashboard.jsx`.
- No button with an `onClick`-less / no-op handler remains in the audited files (each is wired
  or removed).
- Every audited "LOCAL-ONLY that should persist" action survives a page reload.
- `npm --workspace server run typecheck` and `npm run build` pass.
- A short live verification per package (curl or UI + reload).
