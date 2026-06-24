# Frontend "Real + Generic" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax. Branch: `frontend-real-generic`. **Nothing is pushed to main/prod** — verified in the local Docker stack first.

**Goal:** Make every tenant-facing view render the logged-in tenant's REAL data (empty for a fresh tenant) instead of hardcoded demo fixtures, remove demo chrome, and make the track nav reflect the tenant's actual blueprint config.

**Architecture:** The backend APIs already exist and are tenant-scoped/RLS-enforced (`/vehicles`, `/vehicles/timeline`, `/audit`, `/aggregations/*`, `/cards`, `/admin/data-model`, `/integrations`, `/portal`). This is a frontend wiring effort: replace static arrays/constants + `|| fallback` demo values with API data + honest empty states, and drive the track nav from `/admin/data-model`.

**Tech Stack:** Vite + React, `api` client (`app/src/api/client.js`).

## Global Constraints
- The admin views (`admin_users.jsx`, `admin_rbac.jsx`, `admin_structure.jsx`, `data_model.jsx`) are ALREADY API-backed — DO NOT rework them. (They import some `admin_data.js` constants for labels/fallbacks; leave those.)
- Empty state is correct: a fresh tenant must show 0 / "no items" / empty lists — never a hardcoded number or demo row.
- Each task ends with `cd app && npm run build` succeeding (no broken imports, no references to deleted constants).
- Keep the existing styling/layout; only change the data source + remove demo-only chrome.
- Do NOT remove a shared constant from `data.js`/`admin_data.js` if other (admin) code still imports it — only stop USING it in the converted view.
- Commit on branch `frontend-real-generic`; trailer ends `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- No backend changes (the APIs exist). If an endpoint truly doesn't return what's needed, NOTE it rather than editing the server.

---

### Task 1: Vehicles + vehicle search → real `/vehicles`
**Files:** `app/src/views_part2.jsx` (VehiclesView), `app/src/App.jsx` (VehicleSearchPanel), `app/src/timeline.jsx` / VehicleTimeline fallback.
- Replace the hardcoded vehicle array(s) with `api.get('/vehicles')` (+ `?q=`/`?status=` if the component filters). Render an empty state ("No vehicles") when the list is empty.
- VehicleSearchPanel (App.jsx ~88-110): source its list from `/vehicles` (or the already-loaded vehicles), not the fixture; empty → "no matches".
- Vehicle timeline: when `/vehicles/timeline` returns nothing, show an empty/"select a vehicle" state — REMOVE the hardcoded `VEHICLE_TIMELINE` fallback render.
- Build must pass.

### Task 2: Overview snapshot + hero tiles → real values
**Files:** `app/src/App.jsx` (Snapshot ~45-68), `app/src/header_tiles.jsx`, `app/src/i18n.jsx`.
- `header_tiles.jsx`: remove the `finOverdue || 94000` fallback (and any other `|| <number>` demo fallbacks) → show the real computed value (0/€0 when empty).
- Snapshot: the count + "all four tracks" must be computed from the real fetched items, not the literal "23 items". Update `i18n.jsx` `snap.allClear` (and nl/fr variants) so the number/track-count is interpolated, or rephrase to not assert a fake number. Remove the hardcoded "Thursday morning" day reference (use the real current day or drop it).
- Build must pass.

### Task 3: Reports metrics → real data
**Files:** `app/src/reports.jsx`.
- `computeTrack()` currently derives metrics from `SEED_SALES/OPS/WORKSHOP/FINANCE` (`data.js`). Replace with real data: fetch `/aggregations/dashboard` (preferred — check its shape) or the per-track `/cards` the app already loads, and compute the report metrics from that. Empty tenant → zeros/empty charts.
- Keep the saved-reports list (`/reports`) as-is (already real).
- Build must pass.

### Task 4: Integrations + Portal → real only (drop demo fallbacks)
**Files:** `app/src/views_part1.jsx` (IntegrationsView), `app/src/portal.jsx`.
- IntegrationsView: render `/integrations` results; when empty show an empty state — stop falling back to the `INTEGRATIONS` constant.
- Portal: stop falling back to hardcoded `PORTAL_FLEET`/messages — use `/portal` + `/portal/messages`; empty → empty states.
- Build must pass.

### Task 5: Remove demo chrome
**Files:** `app/src/App.jsx` (~520 "How this is wired" footer), `app/src/side_menu.jsx` (~84 "All sources synced" footer), and any "Demo: …" banner (search `action_flows.jsx`/App.jsx).
- Remove the "How this is wired: Talend/PEPPOL/CRM…" footer entirely.
- The "All sources synced · 2 min ago" footer: either remove it, or make it reflect real integration sync status from `/integrations` (if trivial). Default: remove (don't fake it).
- Remove any hardcoded "Demo: sign Brussels…" promo banner/action.
- Build must pass.

### Task 6: Generic track nav + overview tracks from `/admin/data-model`
**Files:** `app/src/App.jsx`, `app/src/side_menu.jsx`.
- On app load, fetch `/admin/data-model` (the tenant's configured tracks). Pass the real track list (key/label/color/order) to `side_menu.jsx` instead of the hardcoded 4-track array, intersected with the user's `allowedTracks`.
- The Overview track cards + the `/cards?track=` fetches should iterate the tenant's actual tracks (from data-model), not the hardcoded sales/ops/workshop/finance set. (If a tenant has different tracks, the overview reflects them.)
- Keep it resilient: if `/admin/data-model` isn't available to a non-admin user, fall back to the tracks implied by the user's `allowedTracks`/`/me/permissions`. NOTE any access limitation rather than hardcoding.
- Build must pass.

### Task 7: Local Docker verification (no prod)
- Rebuild the local stack image from the branch and restart: `docker compose -f docker-compose.local.yml build app && docker compose -f docker-compose.local.yml up -d app`.
- Re-seed if needed (`--profile seed`) so the local demo tenant has real data.
- Verify in the browser (localhost:4000): logging in as the demo admin shows the demo's REAL seeded vehicles/reports/etc.; provisioning a fresh tenant + logging in as its admin shows clean EMPTY states (no fake vehicles/€94k/23 items); no "How this is wired"/"All sources synced" chrome.
- Report what was verified. (Do NOT push to main.)
