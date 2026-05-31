# Nango Integration Button

_Started 2026-05-29 12:58 UTC_

---

## User

okay add the Nango integration as a part of the Add intetation btn. And built it to reflect the rela thing eventhough there is no connection

## Assistant

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: write_file]_

I have everything I need. Now let me build a faithful Nango Connect UI widget. Let me create the component file and its scoped styles.

_[tool: write_file]_

Now the component. Let me build the Nango Connect widget with its provider catalog and multi-screen flow:

_[tool: str_replace_edit]_

Now wire it into `IntegrationsView`. Let me update `views_part1.jsx`:

_[tool: write_file]_

Good question — and yes, that's exactly the right instinct. Here's the honest architecture: **Nango handles the connection** (OAuth/keys, transport, token refresh), but it does *not* know what your data *means*. That's where your Intelligence Layer comes in — after Nango hands over a live connection, the AI reads the source's raw schema and **auto-maps its fields onto your unified DataSource model** so the dashboard can read it without anyone hand-wiring fields.

So the real flow is two stages: `Nango (connect) → Intelligence Layer (AI field-mapping)`. Let me build that second stage too.

_[tool: str_replace_edit]_

Now the styles for the AI mapping panel (app-themed). Appending to `nango.css`:

_[tool: str_replace_edit]_

Now wire the full flow into `IntegrationsView`:Now add the modal render at the end of the view. Let me find the closing of IntegrationsView:

_[tool: str_replace_edit]_

Now add the CSS link and the two script tags to the HTML:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

Let me verify it loads cleanly and test the flow:

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

Clean. Let me navigate to the Integrations view and walk through the flow to screenshot it:

_[tool: eval_js]_

_[tool: screenshot]_

_[tool: save_screenshot]_

The modal is open (16 rows) but html-to-image didn't capture the fixed overlay. Let me use a real pixel capture:

_[tool: view_image]_

_[tool: eval_js]_

_[tool: save_screenshot]_

The modal renders correctly (411×466, z-index 200). The capture tool reloads the page first, so I need to navigate within the step. Let me do a full sequence capture:

_[tool: view_image]_

_[tool: eval_js]_

The capture tool is dropping the fixed overlay, but eval confirms it's live and correct. Let me functionally verify the rest of the flow (consent → connecting → success → AI mapping) via DOM:

_[tool: done]_

Entire flow verified end-to-end: consent (3 scopes) → OAuth connecting → success → AI mapping (scan → 6 mapped rows → ready) → new card added with the "via Nango" badge → Connected stat bumped 9→10. The capture tool just can't grab fixed overlays, but the DOM confirms it all works.

_[tool: fork_verifier_agent]_

Done. The **Add integration** button now opens a faithful **Nango Connect** widget, and on connection hands off to your **Intelligence Layer's AI mapping** — exactly the two-stage architecture you asked about:

**Nango (the connection)** — a self-contained popup matching the real `openConnectUI()` experience: searchable, categorized catalog of 16 providers (Salesforce, HubSpot, Dynamics, Exact Online, QuickBooks, Stripe, SAP, Slack, Teams, etc.), per-provider OAuth consent screens with real scopes *or* API-key entry for key-based providers, a simulated OAuth popup round-trip, success state, and the "Secured by Nango" footer.

**Intelligence Layer (the AI mapping)** — after Nango establishes the connection, the AI reads the source schema and auto-maps its raw fields onto your unified DataSource model, showing confidence scores and flagging low-confidence matches for review. Once confirmed, the source appears as a live integration card with a "via Nango" badge and the Connected count ticks up.

It's all simulated (no live backend), but every screen reflects the genuine flow.

## User

Verifier agent check completed

## Assistant

Verified and passing. The Nango integration flow is live on the **Add integration** button — connect a provider, watch the OAuth round-trip, then the Intelligence Layer's AI maps its schema onto your DataSource and the new source drops into the list. All simulated, no real backend needed.

## User

okay what about having something that could add a logic layer for mapping. So the integrator could could concat 2 or multiple fields into 1 ,... like ETL opetation but only using AI prompting..

## Assistant

_[tool: invoke_skill]_

This fits the Intelligence Layer perfectly — a **prompt-defined transform layer** on top of the 1:1 auto-mapping, so an integrator can say *"join street, city and postcode into one address"* and the AI builds the ETL step. Let me wire it to the real in-prototype Claude API so it actually works, with a graceful fallback. Let me grab the API contract first.

_[tool: read_file]_

The in-prototype Claude API is available — so this transform layer can be genuinely AI-powered. Let me rebuild the AI mapping panel to add a prompt-driven logic layer: type an instruction in plain language, the AI builds the ETL transform (concat / compute / format across multiple source fields) with a live sample preview.

First, enrich the schema profiles with a fuller field pool so multi-field concat makes sense:

_[tool: write_file]_

_[tool: str_replace_edit]_

Now the styles for the logic layer. Appending to `nango.css`:Now update `onMapped` to receive transforms and reflect them on the card:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me add a transform indicator to the integration card, then verify:

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

Clean. Let me functionally test the logic-layer composer end to end:

_[tool: eval_js]_

Excellent — the live AI returned a clean transform: `Contact.FirstName + ' ' + Contact.LastName → contact.fullName` with preview "John Smith". Let me confirm it flows through to the card:

_[tool: done]_

Both transforms generated by the live AI work — including a 3-field concat `account.billingAddress = BillingStreet + ', ' + BillingPostalCode + ' ' + BillingCity`. The card now shows "ƒ 2 transforms". Everything flows through correctly.

_[tool: fork_verifier_agent]_

Done. The AI mapping panel now has a **prompt-defined logic layer** sitting on top of the 1:1 auto-mapping:

- **Plain-language ETL** — type something like *"combine first and last name"* or *"join street, postcode and city into one address"* and the **live AI** builds the transform: which source fields it pulls, the operation (Concatenate / Compute / Format), the formula, and a live sample preview of the output.
- **Multi-field → one** — transforms can fan multiple source fields into a single canonical field, exactly like an ETL derived-column step, but authored by prompt instead of code.
- **Stacked & removable** — add as many as you like; each shows as an editable transform node, and the count carries through onto the integration card (`ƒ 2 transforms`) alongside the "via Nango" tag.

It calls the real in-prototype Claude API, with a heuristic fallback so it still works if the model is unavailable. The architecture now reads cleanly as **Nango (connect) → auto-map → AI logic layer (transforms) → live DataSource**.

## User

Verifier agent check completed

## Assistant

Verified and passing. The prompt-defined logic layer is live — connect a source through Nango, let the AI auto-map it, then author ETL transforms in plain language (multi-field concat, compute, format) that fan into single canonical fields, each with a live sample preview. It all flows through to the integration card.

## User

Any other AI ideas for the integration layer?

## Assistant

Lots — the integration layer is where AI earns its keep, because every connected system is messy in its own way. Here are the strongest ideas, grouped by *when* in the data's life the AI acts. I've starred the ones that demo especially well alongside what you've already built.

**At ingest (extends the mapping/transform layer you have)**
- ⭐ **Natural-language sync filters** — the inbound twin of transforms: *"only sync deals over €50k from Benelux"* or *"skip test accounts."* Prompt-defined row selection, not just field reshaping.
- ⭐ **Entity resolution / dedup** — AI recognizes that "Brussels Energy SA" in Salesforce and "Brussels Energy" in Exact are the *same* customer, and merges them into one canonical record. The single biggest pain in multi-source data.
- **Low-confidence review assistant** — for the rows you flag `review`, AI explains *why* it's unsure and offers 2–3 candidate targets to pick from, instead of just a warning.
- **PII / GDPR classification** — AI tags incoming fields as personal/financial/sensitive and auto-applies masking rules. Very relevant for an EU client.

**At runtime (monitoring the live connection)**
- ⭐ **Schema-drift self-healing** — when a source renames or adds a field, AI detects the drift, proposes a re-map, and flags it — instead of the sync silently breaking. This is the killer "Intelligence Layer" feature.
- ⭐ **Anomaly / data-quality guard** — catches an invoice that's 100× normal, a date in the past, a currency mismatch — and quarantines it before it hits the dashboard.
- **Error triage** — when the MAN API goes degraded (you already show that state), AI reads the error, explains it in plain language, and suggests or takes the fix (re-auth, backoff, transform tweak).

**At build (onboarding new sources)**
- ⭐ **AI connector builder** — for a system with *no* prebuilt Nango integration, point the AI at an OpenAPI spec, API docs, or a sample CSV and it generates the connector + initial mapping. "Bring your own API."

**At query (using the data)**
- **Conversational lineage** — *"which integrations fed the Brussels Energy contract?"* or *"what changed in the last sync?"* — natural-language questions over the DataSource and its audit trail.

My pick for the best demo arc on top of what's there: **schema-drift self-healing** + **anomaly guard** (they make the "Intelligence Layer" name land), then **entity resolution** (the most universally painful problem).

Want me to build one or two of these into the integrations view? I'd suggest wiring them as live AI panels the same way as the transform layer.

## User

I would like you to create and AI reporting area

## Assistant

_[tool: read_file]_

Great addition — an AI reporting area is the natural payoff of having a unified DataSource. Let me look at the app's data and view conventions first, then ask a couple of quick scoping questions.

_[tool: read_file]_

Let me check the routing and nav so the new view slots in cleanly:

_[tool: read_file]_

_[tool: questions_v2]_

I have what I need. Since this is a whole new surface, let me ask a few quick scoping questions so I build the right thing:

## User

Questions answered:
- report_modes: One-click prebuilt report templates (weekly fleet summary, cashflow, pipeline, workshop), Ask in natural language ("How did sales perform this week?")
- report_content: Breakdown by track (Sales / Ops / Workshop / Finance), Simple charts (bars / trend lines), Source attribution (which integrations the data came from)
- live_ai: Both — live with a scripted fallback
- nav_placement: Its own top-level item near Overview
- export: Yes — export to PDF / share
- extras: I was thinkinh that you create the reports via natural language and maybe a flow of questions and normal to choose the format etc...

## Assistant

_[tool: grep]_

Got it — clear plan. I'll build a **Reports** view as its own top-level nav item with: one-click templates, a natural-language composer that opens a short guided builder (period / scope / format), per-track breakdowns with simple charts, source attribution, and PDF export. Live AI writes the narrative; numbers are always computed from the real DataSource (so charts never hallucinate), with a scripted prose fallback.

Let me set up the nav plumbing first.

_[tool: str_replace_edit]_

Perfect — so **Reports** has two parts: a **creation area** (compose/generate) and a **view area** (a library of saved reports you can reopen). I'll build it as a tabbed view: *Create* (composer + templates + guided builder) and *Library* (saved reports, click to view), persisted to localStorage and seeded with a couple of examples.

Let me wire the nav plumbing — i18n keys, icon, route:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now route it in app.jsx:

_[tool: str_replace_edit]_

_[tool: write_file]_

Now the main reports module. This is the biggest piece — data computation, charts, AI prose, the guided builder, the report doc, and the Create/Library tabs:Now the styles:

_[tool: write_file]_

Now link the CSS and add the script tag:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: screenshot]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: sleep]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: sleep]_

The preview thread seems wedged. Let me give it a longer settle and retry:

_[tool: eval_js]_

_[tool: show_html]_

`1+1` times out — the page's main thread is genuinely hung. Let me confirm the environment is otherwise fine by loading a known-good file:

_[tool: eval_js]_

_[tool: str_replace_edit]_

Environment is fine — so the Intelligence Layer page has a real synchronous hang from my changes. The only new top-level code that *executes* on load is `reports.jsx` (it calls `scriptedProse` to build `SEED_REPORTS`). Let me bisect by temporarily removing it:

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: read_file]_

App loads fine without reports.jsx — so the hang is in that file's load-time execution. Let me re-read the one thing that *runs* at load: `SEED_REPORTS` calling `scriptedProse`. Let me make the seeds not call it at module-eval time (lazy instead), which also rules compile-vs-runtime in/out:

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Let me make the seeds lazy so nothing executes at module-eval time, then re-enable and test:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

Lazy seeds fixed the hang. Now let me verify the Reports view actually works at runtime:

_[tool: eval_js]_

Working — h1, both tabs, 4 templates, composer all present. Let me test the Library view and report rendering:

_[tool: eval_js]_

The report doc renders fully: 4 track sections, 12 bars, trend line, 5 source chips, and a **live AI-generated** summary. Let me test the create→builder→generate flow, then reset the stray test entry:

_[tool: eval_js]_

Builder appears with period/format segments and track chips. Let me generate from it and confirm, then reset the test data:

_[tool: eval_js]_

The full create flow works end to end with live AI. Let me clear my test runs so the user starts with the clean seeded library:

_[tool: done]_

Root cause fixed: building the seed reports at module-load time was the problem; deferring it to first render resolves it cleanly. The whole Reports area now works — let me do the final handoff.

_[tool: fork_verifier_agent]_

Done — the **Reports** area is live as its own nav item, with both surfaces you asked for:

**Creation area** — a natural-language composer (*"How did sales perform and what's at risk?"*) that opens a short guided builder to confirm **period / scope / format**, plus four one-click templates (weekly fleet summary, cashflow, pipeline, workshop throughput).

**View area (Library)** — saved reports as cards you can reopen anytime, persisted across refreshes and seeded with two examples.

**The report itself** — an AI executive summary, a synced-records trend line, and a per-track breakdown (Sales / Ops / Workshop / Finance) with metric tiles + bar charts, source attribution chips, and **Export PDF**. The narrative is written by the **live AI** (with a scripted fallback), while every number and chart comes straight from the DataSource so the figures never drift.

One thing I hit and fixed along the way: building the seeded reports at load time wedged the page — deferring it resolved it, and the app is responsive again.

A natural next step, if you want it: wire the **schema-drift / anomaly** monitors we discussed into the integrations view, or let reports be **scheduled** (auto-generated weekly into the Library). Just say the word.

## User

Verifier agent check completed

## Assistant

Verified and passing. The AI Reporting area is complete — Create + Library surfaces, guided natural-language builder, live-AI narrative over real DataSource figures, per-track charts, source attribution, and PDF export. Whenever you're ready, the schema-drift/anomaly monitors or scheduled reports are the natural next builds.

## User

I also need a pure dashboard chart creation that wher you can view live progress and the creation of the charts should also reside as first thing you see when you enter the reporting area

## Assistant

_[tool: write_file]_

Got it — the reporting area should **open onto a live dashboard** of charts that update in real time, with the ability to **build your own charts** right there. I'll add a **Dashboard** tab as the default landing (before Create and Library): live-ticking charts (line/bar/donut/stat) driven off the DataSource, a pulsing "live" indicator, and an "Add chart" builder with a live preview.

Let me build the dashboard module:Now the dashboard styles, appended to reports.css:

_[tool: read_file]_

_[tool: read_file]_

_[tool: write_file]_

Now wire it into `reports.jsx` — add a Dashboard tab as the default landing:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update the hero copy and add the CSS/script includes:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

Dashboard is the default landing, 6 live charts render (line/stat/donut/bar), and live progress is confirmed — records synced ticked 2,840 → 2,872. Let me test the chart builder:

_[tool: eval_js]_

The builder works — 10 metrics, adaptive type options (Receivables → Donut/Bar), live preview donut, and the chart was added (the inflated count was just the preview card also matching `.dbCard`). Let me reset my test data for a clean handoff:

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. Entering **Reports** now lands you on a **live Dashboard** first — exactly as you asked:

- **Live charts** — a grid of line / stat / donut / bar widgets streaming off the DataSource, with a pulsing *Live* indicator. Values tick on an interval so you literally watch progress move (records synced climbing, throughput and latency scrolling, on-time % drifting).
- **Build your own** — an **Add chart** builder where you pick a metric, choose a visual (line / bar / donut / stat), title it, and see a **live preview** before dropping it onto the dashboard. Your layout persists across refreshes.
- **Still there** — *Create* (natural-language + templates) and *Library* (saved reports) remain as the second and third tabs.

The earlier load-hang lesson carried over cleanly — the dashboard inits its live state at render, not at module load, so the main thread stays responsive.

Next natural steps if you want them: make a built chart **pin into a generated report**, or add **schema-drift / anomaly** live tiles to the same dashboard.

## User

Verifier agent check completed

## Assistant

Verified and passing. The reporting area now opens on a **live Dashboard** with real-time ticking charts and an in-place chart builder (with live preview), backed by *Create* and *Library*. Everything persists and the app stays responsive. Whenever you want, I can let dashboard charts pin into generated reports or add anomaly/drift live tiles.

## User

okay this was correct by I needed this to only show the pipeline data  as this is a business followup system not a infra system

## Assistant

_[tool: str_replace_edit]_

Makes sense — this is a business follow-up tool, so the dashboard shouldn't be showing infrastructure telemetry (sync throughput, integration latency, records synced). Those are plumbing metrics that belong on an ops/infra console, not here. Let me swap them for pipeline/business KPIs and keep the live ticking on things that actually mean business progress (pipeline value moving, deals closing, follow-ups clearing).

_[tool: str_replace_edit]_

Got it — drop the live streaming entirely. It should be a static pipeline snapshot, not a ticking telemetry feed. Let me make the data a one-time snapshot, remove the interval and the pulsing "Live" indicator, and switch the stat deltas to static period-over-period comparisons.Now make the data a static snapshot (no interval), update the stat to show static change, and remove the live bar:

_[tool: str_replace_edit]_

Now update the DashboardTab bar, default charts, and the builder preview label:

_[tool: str_replace_edit]_

Now update the file header comment and the `.dbAsOf` style, plus the reports hero copy:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me clear my old persisted dashboard (which had the infra charts) and verify:

_[tool: show_html]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

Clean and responsive. Let me verify the dashboard now shows business-only static charts:

_[tool: eval_js]_

_[tool: eval_js]_

All confirmed: business-only cards (Open pipeline, At-risk, Closed-won, Pipeline by stage, On-time delivery, Open items by track), static period-over-period deltas, no live badge, and the value held steady over 4s. Let me confirm the builder's metric list is also infra-free:

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: sleep]_

The page just reloaded — let me wait for Babel to compile and retry:

_[tool: eval_js]_

_[tool: get_webview_logs]_

_[tool: sleep]_

_[tool: str_replace_edit]_

Found it — the `ChartBuilder` still defaulted its metric to `'throughput'`, which I removed, so opening the builder crashed the whole tree. Let me fix the default:

_[tool: show_html]_

_[tool: sleep]_

_[tool: eval_js]_

All business metrics, no infra, builder opens cleanly with a working preview. Let me do the final handoff:

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. The dashboard is now a **static pipeline snapshot** built for a business follow-up system, not an infra console:

- **Infra metrics removed** — sync throughput, integration latency, and records-synced are gone.
- **Business KPIs only** — Open pipeline, At-risk pipeline, Closed-won this week, Pipeline by stage, On-time delivery, Open items by track (plus follow-ups due, new leads, receivables and work orders available in the builder).
- **No streaming** — values are a one-time snapshot headed "Pipeline snapshot · as of 29 May 2026"; the pulsing live indicator is gone and stat cards now show static period comparisons (e.g. *▲ +1.4% vs last month*).
- The chart builder and Create/Library tabs all still work.

One fix along the way: the builder had been defaulting to a now-deleted metric, which crashed it — repointed it to a live business metric and it's clean.

## User

the pipelines should be feault closed when  I press on the tracks in the left menu so it give a better overview

## Assistant

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

Got it. Right now clicking a track in the left menu auto-expands its pipeline. You want it to stay collapsed so you land on the scorecard overview instead. I'll change it to scroll to and briefly highlight that track's scorecard, leaving the pipeline closed until you choose "View items".

Let me read the rest of ScorecardRow:Now let me make the edits. First, the scorecard gets an id and focus highlight:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now update the app.jsx effect to focus the scorecard instead of opening the pipeline, and pass `focused` down:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now add the focus-highlight style. Let me check the scorecard CSS:

_[tool: read_file]_

_[tool: str_replace_edit]_

Now verify — clicking a track should focus its scorecard and leave the pipeline closed:

_[tool: show_html]_

_[tool: sleep]_

_[tool: eval_js]_

_[tool: eval_js]_

Working exactly as intended: clicking a track focuses its scorecard (highlight pulse), the pipeline stays **closed**, and the highlight clears after 2s. Let me confirm the "View items" button still opens the pipeline on demand:Both behaviors confirmed. Let me hand off:

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. Clicking a track in the left menu now keeps its pipeline **closed** — it lands you on the overview and briefly highlights that track's scorecard so you can see the summary first. The pipeline only expands when you explicitly hit **"View items"** on the scorecard, so you get the high-level overview by default.

## User

No open pipelienes should be closed when you click one of the tracks

## Assistant

_[tool: str_replace_edit]_

Got it — clicking a track should also collapse any pipelines that are already open, so you always return to a clean overview. Let me update the effect to close all tracks:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Also let me make it robust for the case where you click the track that's already active (e.g. after opening its pipeline) — that should still collapse. I'll handle the collapse right at click time in the menu:Now wire `onTrackSelect` in app.jsx. Let me find where `<SideMenu` is rendered:

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: sleep]_

_[tool: eval_js]_

_[tool: eval_js]_

Two open pipelines (Sales + Finance) both collapsed when clicking Operations, and Operations' scorecard got the focus highlight. Now the same-track edge case — open a pipeline then click its own track:Both cases work — including re-clicking the already-active track. Let me hand off:

_[tool: done]_

_[tool: fork_verifier_agent]_

Done. Clicking any track in the left menu now collapses **all** open pipelines and returns you to a clean scorecard overview (with that track's card briefly highlighted). It works even if you re-click the track that's already active.

## User

Verifier agent check completed

## Assistant

Verified and passing. Clicking a track now always collapses any open pipelines and drops you back to the clean overview with that track's scorecard highlighted — confirmed working including the re-click-active-track edge case.

## User

Apply comment

## Assistant

_[tool: view_image]_

I can see the discussion: selecting a department in the left column should switch you into *that* department's view — not just subtly highlight it, but **filter the others out** so it's unambiguous which department you're looking at. Let me look at the reference image first.

_[tool: str_replace_edit]_

Clear. Right now selecting Finance highlights it in the menu but still shows all four scorecards. I'll make selecting a department **filter the board to just that department** (others hidden), with a banner showing which department you're in and a "Show all departments" button to clear. The "Overview" item remains the all-departments view.

Let me restructure `ScorecardRow`:

_[tool: grep]_

Now add the i18n keys and wire `only`/`onClearFilter` in app.jsx. Let me find the i18n anchor:

_[tool: str_replace_edit]_

Now wire `only` and `onClearFilter` in app.jsx:

_[tool: str_replace_edit]_

_[tool: read_file]_

Now let me add the CSS for the filter bar and single-card layout. Let me also check whether the global Snapshot and "how it's wired" footer should be hidden when filtered — let me see the overview structure:

_[tool: read_file]_

Let me hide the global Snapshot and the "how it's wired" footer when viewing a single department, for a clean focused view:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now hide the "how it's wired" footer when filtered. Let me see its exact wrapper:

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now the CSS for the filter bar and single-card layout:

_[tool: str_replace_edit]_

