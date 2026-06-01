# Authorization enforcement (Package H)

**Date:** 2026-06-01
**Trigger:** RBAC field rules only filtered the `/records` preview, not live data
("hiding contract value from Eva, she can still see it"). Audit found a pattern:
several config/permission controls saved but weren't enforced at runtime.

## What was fixed (enforced on live data, each with tests)

| # | Gap | Fix |
|---|---|---|
| **H1** | Field rules only on `/records` | `rbac/applyCardRules` maps live card fields → governing `dataType.field`; enforced in `/api/cards` (list+get). Money in aggregations + reports masked when caller can't see contract values. |
| **H2** | Stage Config editor saved to DB but runtime read static config | `loadStages()` reads DB `StageConfig` (static fallback); `moveStage` (labels+lock) and auto-escalate (SLA) now DB-driven. |
| **H3** | `role.tracks` stored, never enforced | Parse the human track labels → viewable track keys; `listCards`/`getCard` hide disallowed tracks; `/me/permissions` returns `allowedTracks`; side menu hides them. |
| **H4** | User scope ignored (everyone saw all rows) | `rbac/scope.visibleCompanyIds()` resolves the company set under the user's scope via the OrgNode tree (company/country/region + secondary scopes); `listCards`/`getCard` filter by it. Group scope = all. |

## H5 — Data sharing: deliberately NOT enforced (documented)

The `DataSharing` model maps fuzzy data *types* (Pipeline, Invoices, Vehicles,
Workshop orders, …) to a mode (`private`/`shared`/`group`), with the UI promising
"most-restrictive-wins at runtime."

**Decision: do not enforce; mark the UI "Advisory".** Rationale:
1. **Empty by default** — no rows exist unless an admin edits, so there's nothing
   to enforce in the seeded product.
2. **Underspecified semantics** — the type→track→company mapping and how
   "most-restrictive-wins" composes with H4 scope (esp. for group/region users
   and admins) needs a product spec. Several reasonable interpretations conflict.
3. **Auth-safety** — for an access-control feature, shipping a *guessed*
   implementation risks wrong exposure (over- or under-sharing). That is worse
   than not enforcing. Row-level access is already governed by user scope (H4).

The Data-sharing section now carries an **"Advisory"** badge so the UI is honest:
the modes persist, but cross-company sharing is governed by user scope, not these
toggles. Revisit with a written spec if real cross-company sharing is needed.

## Already enforced before this pass
Cross-track triggers (cascade reads DB triggers), JWT auth, stage-lock +
auto-escalate prefs (now reading DB stage config via H2).

## Tests
`tests/api/{rbac-live,stage-config,track-access,scope}.test.mjs` cover H1–H4
(32 API tests total, all green). H5 has no enforcement to test.
