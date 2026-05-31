# Design Spec — Intelligence Layer

> Context document for a Claude design session. Last updated 2026-05-27.
> Prepared by: DLPE-Group consultancy.
> Pitch target: a European commercial vehicle leasing and fleet management group (operating across Benelux and Germany). The target's name must not appear anywhere in the design itself.

---

## What this is

A **cross-system intelligence layer** — a clean, branded dashboard that sits on top of existing ERP, CRM, finance, and operations systems and surfaces correlated, actionable data in one place. It does not replace those systems. It is the lens through which a manager sees what needs attention *right now*, without digging through five platforms.

The Odoo CRM prototype (see `PROJECT_SUMMARY.md`) is a smaller predecessor that demonstrates the same visual language and gated-stage logic.

---

## Terminology (clarify before reading the rest)

The pitch involves three parties. The spec uses these terms consistently:

| Term | Who |
|------|-----|
| **The consultancy** | DLPE-Group — the team building and pitching the system |
| **The leasing group** | The pitch target — a commercial vehicle leasing company. Never named in the design. |
| **Fleet operator** | The leasing group's customers — logistics, retail, construction firms that lease vehicles. They use the **customer portal**. |

When the spec says "users", it means the leasing group's internal staff (sales, ops, workshop, finance). When it says "fleet operators", it means the leasing group's *customers*.

---

## The core idea

> *"A layer on top of ERP, mail, HR, sales and other systems where they can build something on top that shows a correlation of data they can act on."* — initial client brief

The product answers three questions at a glance for the internal team:

1. **What is blocked?** Nothing can proceed until a previous step is done.
2. **What needs action?** Things that are stuck, overdue, or awaiting a person.
3. **Where is the money / where is the vehicle?** Value and physical asset state at every step.

And one question for fleet operators (via the customer portal):

4. **What is happening with my fleet?** Vehicle status, upcoming service, delivery dates, invoices.

---

## Key design principles

### Clarity over density
The reference mockup (WhatsApp image, 2026-05-26) was criticized as "too AR" — too much visual noise, too many grid elements without hierarchy. The redesign is ruthlessly selective: only what a manager must act on, not everything that exists.

### Enforced step logic
The client called out a workflow pattern from past experience (Athos, also Autorola fleet monitor): **a stage cannot start until the previous stage is complete**. This is a workflow constraint baked into the UI, not just visual.

- Locked stages are greyed out with a lock icon and a tooltip explaining what must be done first
- Progress is always directional (left-to-right or top-to-bottom)
- Each stage has an owner, a deadline, and an explicit completion state

### Transparency
Every number is traceable. A count of "12 vehicles awaiting service" clicks through to exactly those 12. A revenue figure links to the contracts that compose it. No black-box aggregates.

### One vehicle, one timeline
A single vehicle threads through Sales → Operations → Workshop → Finance over its multi-year lifecycle. The dashboard must let a user pick any vehicle and see *every* stage it has passed through and what's next. This is the killer feature.

---

## The four tracks (from the client's own process flow)

The leasing group's PDF process map shows four parallel tracks, color-coded in their original document. The dashboard mirrors this structure exactly — using their internal mental model is the fastest way to make them recognize it as theirs.

| Track | Frame color (in client PDF) | Owner role |
|-------|----------------------------|------------|
| **Sales** | Blue | Account managers, sales directors |
| **Operations** | Red | Fleet ops, service coordinators |
| **Own workshop** | Green | Workshop manager, mechanics |
| **Finance** | Light purple | Bookkeepers, accounts payable/receivable |

A separate **customer portal** (yellow/orange in the PDF) consumes the same data and exposes a filtered view to fleet operators.

---

### 1. Sales track (blue)

Lead → qualified → offer or no-offer → signed contract → vehicle ordered.

| Stage | Notes |
|-------|-------|
| Lead | Inbound via website, mail, Salesforce, or other CRM. Auto-imported. |
| Sales follow-up to meeting | Qualify; assess fleet needs. |
| Offer / No offer | Branching decision. "No offer" closes the lead with a reason code. |
| Offer signed → Contract | Customer e-signs the offer; contract drafted. |
| Order vehicle | Includes vehicle + build/upfit + extras. Triggers Operations track. |

**Renewal-specific rule:** for renewal deals, the days-in-stage threshold is calculated *backwards from contract expiry*. A renewal in "Offer sent" with 30 days to expiry turns amber; under 10 days turns red. A renewal past expiry is always red regardless of stage.

---

### 2. Operations track (red) — the heart of the business

This is where most of the leasing group's daily work happens. The dashboard must treat Operations as a first-class citizen, not a placeholder.

Sub-flow A — **New vehicle delivery:**
| Stage | Notes |
|-------|-------|
| Vehicle ordered | Triggered by signed contract in Sales. |
| Expected delivery date | Includes vehicle + build + extras. Confirmed by supplier. |
| Vehicle order overdue | Auto-flag when supplier date slips past expected. |
| Confirmation from suppliers on delivery date | Updates expected delivery. |
| Confirm delivery date | Internal sign-off; informs fleet operator. |
| Vehicle in fleet | Lifecycle officially starts. |

Sub-flow B — **Service / annual inspection cycle (recurring):**
| Stage | Notes |
|-------|-------|
| Service due within 90 days | Auto-trigger on rolling calendar. Includes annual safety inspection. |
| Send message to fleet operator | Automated communication. |
| Received proof of inspection / work | If fleet operator self-services. |
| Reset date for next inspection | Closes one cycle, opens the next. |

Sub-flow C — **Coordinated workshop visit (when leasing group handles service):**
| Stage | Notes |
|-------|-------|
| Contact fleet operator with date | Based on replacement-vehicle planning. |
| Replacement vehicle in | Loaner vehicle delivered to operator. |
| Create order to workshop | Internal handoff (kicks off Workshop track). |
| Plan transport to workshop | Logistics for the original vehicle. |
| Vehicle moved to workshop | Handover point — control passes to Workshop. |
| Expected return date | With 1-day reminder before due. |
| Vehicle ready for pickup at workshop | Workshop signals completion. |
| Vehicle picked up — send message to fleet operator | Operator collects replacement-swap. |
| Vehicle picked | Loop closed; loaner returned. |
| Invoice from workshop received? | Triggers Finance. |
| Close order | Lifecycle of this service event ends. |

**Note:** "Service due within 90 days" is the single most important Ops signal. Country managers want this on the main dashboard, not buried in a sub-page. It directly affects fleet utilization and customer satisfaction.

---

### 3. Own workshop track (green) — internal repair flow

A parallel flow when the leasing group's own workshop handles service rather than a third-party shop.

| Stage | Notes |
|-------|-------|
| Vehicle planned for own workshop | Decision point in Ops. |
| Create workshop order | Internal work order. |
| Order parts | Triggers supplier purchase order. |
| Vehicle arrived in workshop | Logged on intake. |
| Parts delivered | Parts and vehicle co-located before work starts. |
| Invoice received PEPPOL | Supplier e-invoice for parts (via PEPPOL standard). |
| Vehicle repaired | Work complete; ready to release. |
| Invoice sent by PEPPOL | Internal invoice to fleet operator (via PEPPOL). |
| Invoice suppliers received | Closes parts purchase. |

PEPPOL is non-negotiable. The Benelux operates heavily on PEPPOL-based e-invoicing — naming it in the spec signals the design understands the regulatory and operational reality.

---

### 4. Finance track (light purple)

Triggered by signed contracts in Sales and by completed work in Operations/Workshop. Handles invoicing in and out.

| Stage | Notes |
|-------|-------|
| Invoice to make | Auto-triggered when a contract is signed or a service order closes. |
| Invoiced — waiting payment | Invoice sent to fleet operator (often via PEPPOL). |
| Paid | Recurring billing schedule begins for active leases. |
| Invoice received from supplier | For workshop parts, vehicle purchases, third-party services. |
| Invoice approved & paid | Closes the supplier purchase loop. |

Finance is a *recurring* track for active leases — monthly invoicing continues for the contract life. The demo focuses on **contract initiation** (first invoice after signing) and **overdue payment** (most-actionable Finance signal).

---

### 5. Customer portal (yellow/orange) — separate UI surface

The customer portal is a **separate web app** that exposes a filtered, fleet-operator-scoped view of the same underlying data. Showing it in the pitch demonstrates that the intelligence layer powers both internal and external experiences from one data model.

The portal shows a fleet operator:
- Their vehicles (current fleet, with status: in fleet, in workshop, awaiting delivery)
- Upcoming services and inspections per vehicle
- Open invoices (received from the leasing group)
- Messages from the leasing group (delivery confirmations, service reminders, pickup notifications)

What the portal does **not** show: anything internal — supplier invoices, workshop margins, sales pipeline, other fleet operators' data. Hard tenant isolation.

For the pitch demo: build one fleet-operator login showing 3–4 vehicles in mixed states (one delivered, one awaiting service, one in workshop, one overdue invoice).

---

## Integration points (from the client PDF)

The PDF names specific systems. Use these in the spec — they signal credibility.

| System | What it does |
|--------|-------------|
| **Talend** | ETL — pulls and transforms data between systems |
| **PEPPOL** | Pan-European e-invoicing standard. Used for both inbound supplier invoices and outbound customer invoices. |
| **CSV in / CSV out** | Bulk import/export for systems without direct APIs |
| **API** | Direct REST/SOAP integrations where available (CRM, suppliers, finance system) |
| **Finance system** | Their existing accounting platform — the dashboard triggers actions in it, doesn't replace it. |

The dashboard's **DataSource layer** (from the Odoo prototype pattern) abstracts all of these. The UI never knows whether a data point arrived via Talend overnight, a real-time API call, a PEPPOL e-invoice, or a CSV upload. It just renders the current state.

---

## UI components required

### Header (60px tall)
Logo left, search center, notifications + user avatar right. No marketing CTA. No top-level "Sales / Finance / Ops" tabs — tracks are sections of one dashboard (see Layout decision).

### Stat tiles row (4 tiles, ~120px tall)
The four numbers a country manager scans first. Order matters — most urgent leftmost:

1. **Service due within 90 days** — count + vehicle list link. *Most-checked Ops number.*
2. **Renewals at risk** — count + € value of renewals where expiry is < 30 days and not yet signed. **Amber accent ring.**
3. **Awaiting signature** — count + € value of contracts at signature stage.
4. **Overdue invoices** — total € value the leasing group is owed past due date.

Each tile clickable; filters the tracks below.

### Stage rail per track
Horizontal rail of stage chips at the top of each track section. ✓ Completed, ● Active, 🔒 Locked. Each chip shows the count of items currently at that stage.

```
[✓ Lead] → [✓ Meeting] → [● Offer sent] → [🔒 Contract] → [🔒 Signed]
```

### Item cards
The atomic unit of the dashboard. Compact by default, expandable inline. Each card carries:
- Customer / fleet operator name
- Type badge (NEW, RENEWAL, SERVICE, WORKSHOP, INVOICE)
- Vehicle identifier (when applicable — license plate or VIN tail)
- Value (€) or quantity (number of vehicles)
- Current stage
- Days in stage (or days-to-event for upcoming things like service)
- Owner avatar
- A single stage-specific CTA button ("Send follow-up", "Confirm delivery date", "Create invoice", etc.)
- A 4px left-edge color stripe (green/amber/red) for urgency

### Cross-system data badges
Small icons on each card indicating data source: a CRM logo (anonymized), a PEPPOL badge, a Talend tag. Reinforces the "layer on top" concept and helps users trust where data came from.

### Vehicle timeline (drill-down view)
Click any vehicle on any card → a full-page timeline view. Horizontal timeline of every stage that vehicle has passed through (Lead → Order → Delivery → first Service → second Service → ...) with dates, owners, and linked documents (signed contract, invoices, inspection proofs). This is the **"one vehicle, one timeline"** killer feature.

### Customer portal (separate view)
A simpler version of the dashboard, scoped to one fleet operator. Same visual language, less data, no internal metrics. Shows their vehicles, their services, their invoices.

---

## What to build for the pitch demo

In priority order:

1. **Internal dashboard overview** — header, 4 stat tiles, all four track sections visible on one screen (collapsible)
2. **Sales track** — 4–6 deal cards across stages, including one renewal at risk
3. **Operations track** — 6–8 vehicle cards: one awaiting delivery, two in service window, one in workshop, one with replacement vehicle out
4. **Workshop track** — 3–4 work order cards: one awaiting parts, one in repair, one ready for pickup
5. **Finance track** — 4 invoice cards: one just-triggered from Sales, one overdue from a fleet operator, one supplier invoice received via PEPPOL
6. **Sales → Ops auto-trigger demo** — a signed deal in Sales creates a "Vehicle ordered" card in Operations live
7. **Vehicle timeline drill-down** — click any vehicle → full lifecycle view
8. **Customer portal teaser** — separate screen, one fleet operator's view of their 3–4 vehicles

What to defer post-pitch:
- Real PEPPOL integration (mock the PEPPOL badges)
- Real CRM/finance API connections (mock data using the DataSource pattern)
- Mobile layouts (desktop-first)
- Multi-language UI (English for the pitch; Dutch/French/German for later)
- Workshop scheduling / capacity planning views

---

## Visual language

- **Background:** white (`#FFFFFF`). No warm cream.
- **Primary brand color:** a single brand teal — exact hex to be confirmed with the pitch target's brand. Placeholder: `#028090`.
- **Track accent colors** (echo the client PDF):
  - Sales = blue accent
  - Operations = red-orange accent
  - Workshop = green accent
  - Finance = light purple accent
  These are subtle (section header underline, badge color) — not full backgrounds. The dashboard is still primarily white with status coloring driving urgency.
- **Status family:** green = on track, amber = approaching SLA, red = blocked or overdue. Used as 4px left-edge stripes on cards.
- **Cards:** white, 0.5px border, `border-radius: 8px`, subtle hover lift.
- **Stage chips:** filled circle = active, hollow = available, grey + lock = locked, check = complete.
- **Typography:** clean sans-serif (Inter, system fonts). Two weights only — 400 regular, 500 medium. No bold-on-bold.
- **Icons:** outlined (Tabler or similar). Never icon-only buttons — always paired with a label or tooltip.
- **No decoration:** no gradients, no shadows beyond a single hover lift, no glow effects, no purple/pink unless it's the Finance track accent.

---

## Industry context (the world the dashboard lives in)

The leasing group runs **long-cycle, high-value commercial vehicle contracts**. Implications:

- A typical deal: 20–200 vehicles, 3–5 year full-service lease, €500k–€5M total value.
- Sales cycles run months. "Days in stage" thresholds reflect this — 7 days in Offer is fine, 30 days is concerning.
- Renewals are as important as new business. The Sales track must handle both equally well.
- The Operations track is *where the money is made* — fleet utilization, on-time service, replacement vehicle coordination. A vehicle out of service for an extra day costs the leasing group margin and the fleet operator productivity.
- PEPPOL e-invoicing is the norm in Benelux. The dashboard must speak PEPPOL natively.

---

## Sample data (use this in the mockup, not lorem ipsum)

### Sales track
| # | Customer | Value | Type | Stage | Days | Owner | Status |
|---|----------|-------|------|-------|------|-------|--------|
| 1 | Rotterdam Logistics B.V. | €1,240,000 | New — 48 vehicles, 4yr | Offer sent | 14 | Eva de Vries | red |
| 2 | Hamburg Distribution GmbH | €3,150,000 | Renewal — 120 vehicles | Contract | 6 | Markus Weber | green |
| 3 | Antwerp Retail Group NV | €620,000 | New — 22 vehicles, 3yr | Meeting | 3 | Sophie Janssen | green |
| 4 | Eindhoven Construction B.V. | €1,150,000 | Renewal — 42 vehicles | Contract | 11 | Markus Weber | red (expiry slipping) |
| 5 | Brussels Energy SA | €2,460,000 | Renewal — 78 vehicles | Signed | 0 | Markus Weber | green (→ triggers Ops) |

### Operations track
| # | Vehicle / Fleet | Stage | Days / Date | Owner | Status |
|---|-----------------|-------|-------------|-------|--------|
| 1 | Brussels Energy SA — 78 vehicles | Vehicle ordered (just triggered) | day 0 of expected 90 | Tom Janssens | green |
| 2 | Köln Last Mile — VAN-4421 | Expected delivery date | 3 days late | Pieter de Boer | amber |
| 3 | Amsterdam Cold Chain — TRK-1108 | Service due within 90 days | 12 days | Hannah Müller | amber |
| 4 | Düsseldorf Bau — TRK-7702 | Vehicle moved to workshop | 2 days | Hannah Müller | green |
| 5 | Rotterdam Logistics — VAN-3344 | Vehicle ready for pickup | today | Hannah Müller | green (action needed) |
| 6 | Hamburg Distribution — TRK-9012 | Replacement vehicle in | day 1 of 5 | Tom Janssens | green |

### Workshop track
| # | Vehicle | Stage | Status |
|---|---------|-------|--------|
| 1 | TRK-7702 (Düsseldorf Bau) | Order parts | green |
| 2 | VAN-3344 (Rotterdam Logistics) | Vehicle ready (awaiting pickup) | green (action) |
| 3 | TRK-5520 (Antwerp Retail) | Parts delivered, repair in progress | green |
| 4 | VAN-8801 (Köln Last Mile) | Invoice received PEPPOL — €1,240 | green (paid) |

### Finance track
| # | Customer / Supplier | € | Stage | Status |
|---|---------------------|---|-------|--------|
| 1 | Brussels Energy SA | €2,460,000 | Invoice to make (just signed) | green (auto-triggered) |
| 2 | Munich Foods Logistics GmbH | €94,000 | Invoiced — waiting payment, 31d overdue | red |
| 3 | Luxembourg Distribution S.à.r.l. | €185,000 | Invoiced — waiting payment, 12d | amber |
| 4 | Supplier: MAN Trucks AG | €87,500 | Invoice received PEPPOL — awaiting approval | green |

All numbers are realistic for a mid-sized Benelux/German fleet leasing operation. The mix of new business, renewals, supplier invoices, and vehicle-level operations should make the pitch audience feel "this is built for us."

---

## User stories (real flows the design must support)

### Story 1 — Monday morning triage (Sales manager)
Eva opens the dashboard at 9am Monday. "Renewals at risk" tile shows €1.15M across 1 deal. She clicks. The Sales track filters to Eindhoven Construction — €1.15M renewal, contract expires in 18 days, still at Contract stage. She clicks the card; it expands inline. Last contact was 11 days ago. She hits **"Send follow-up"** from the card itself. The card moves to amber. Total time: 90 seconds. She moves on to the red card in Sales (Rotterdam Logistics offer overdue).

### Story 2 — Operations daily standup (Fleet ops manager)
Tom opens the dashboard at 8am. "Service due within 90 days" tile shows 14 vehicles. He clicks; the Operations track filters. Three are flagged amber. For one (Amsterdam Cold Chain, 12 days to service), he hits **"Plan workshop visit"** — opens the workshop scheduling flow. The card transitions to "Contact fleet operator with date". He sees the replacement vehicle plan auto-suggested based on availability. Two clicks later, the fleet operator gets an automated message via the customer portal.

### Story 3 — Sales-to-Ops handoff (live, during the demo)
Markus marks Brussels Energy as **"Contract signed"** in Sales. Immediately:
- A new card appears in Operations: "Brussels Energy — 78 vehicles, Vehicle ordered, day 0"
- A new card appears in Finance: "Brussels Energy — €2.46M, Invoice to make"
- The customer portal for Brussels Energy now shows: "Order confirmed — vehicle delivery dates being coordinated"

One action, three downstream effects, visible on one screen. **This is the pitch's killer moment.**

### Story 4 — Director's overview (Country manager)
The country manager opens the dashboard once a week. They scan the four stat tiles, glance at the red count across all tracks (currently 3), and hover any red card to see what's blocked and whose desk it's on. Total time on dashboard: 10 seconds. If nothing's red, they close the tab. The dashboard must reward closing — not punish with empty space.

### Story 5 — Fleet operator's view (customer portal)
A logistics company logs into the customer portal. They see 12 vehicles. Two flagged for upcoming service. One in workshop with a replacement vehicle currently with them. One overdue invoice they need to pay. They can message the leasing group from any vehicle's detail view. They cannot see anyone else's data.

---

## Empty, loading, and error states

### Empty states
- **No leads** — Sales section shows: *"No leads in pipeline. Connect Salesforce or add a lead manually."* with CTA.
- **No service due** — green checkmark banner: *"No vehicles need service in the next 90 days."* This is a reward state — don't punish with empty cards.
- **No workshop orders** — section collapses to a thin label: *"Workshop activity appears here when service is scheduled."*
- **All clear across all tracks** — top banner: *"Everything is on track. Nothing needs your attention right now."*

### Loading states
- Stat tiles skeleton-shimmer for max 800ms.
- Track cards render as skeleton list, then populate. No "Loading..." text.
- If load exceeds 3s, show source: *"Still fetching from CRM..."* or *"Awaiting Talend sync..."* — name the integration so users know what's slow.

### Error states
- **API unreachable** — amber dismissible top banner: *"CRM data may be out of date — last synced 18 minutes ago. [Retry]"*. Pipeline still renders with cached data. Never blank the screen.
- **PEPPOL feed failure** — Workshop and Finance sections show inline warning per affected card: *"Invoice status pending — PEPPOL feed delayed."*
- **Permission denied** — locked section with message: *"You don't have access to this track. Ask your admin."*
- **Partial failure** — render what loaded; show inline retry on what didn't. Never fail the whole page for one broken track.

---

## Anti-spec — what this should NOT look like

The reference mockup (WhatsApp image) is what we're moving *away from*. Be explicit:

- **No warm cream / beige backgrounds.** White only.
- **No grid of identical placeholder shapes.** Every card carries real information.
- **No decorative thin borders on everything.** Single 0.5px per card, or use background contrast — not both.
- **No "Get in touch" / marketing CTAs in the header.** This is an internal tool.
- **No top-nav with "Sales / Finance / Ops" as primary tabs.** Tracks are sections of the same dashboard. See Layout decision.
- **No center-aligned body text or card content.** Left-align everything. Center is for empty states and page titles only.
- **No icons without labels.** Every icon needs a label or tooltip.
- **No more than 2 accent colors in active use.** Brand teal primary + status family (green/amber/red). Track accents (blue/red/green/purple) are subtle — section underlines only, not card backgrounds.
- **No fake data that looks fake.** Use the sample data above. No "Customer A", no "Lorem ipsum".
- **No vehicle illustrations.** Vehicles are referenced by license plate / VIN tail, not little truck icons. This is a working tool, not marketing.

---

## Layout decision (pre-made, don't ask Claude design to re-decide)

**Stacked sections on a single dashboard page**, not tabs.

Top to bottom:
1. **Header** (60px) — logo, search, notifications, avatar
2. **Stat tile row** (4 tiles, ~120px) — service due, renewals at risk, awaiting signature, overdue invoices
3. **Sales section** (collapsible, expanded by default) — stage rail + 4–6 cards
4. **Operations section** (collapsible, expanded by default) — stage rail + 6–8 cards
5. **Workshop section** (collapsible, collapsed by default unless red items present) — 3–4 cards
6. **Finance section** (collapsible, expanded by default) — 4 cards

A separate route `/portal` renders the customer portal — same shell, different data scope, simpler stat tiles tuned for fleet-operator concerns (next service, open invoices, vehicles in workshop).

When data volume grows post-pitch, individual tracks can become their own pages with deeper filtering. That's a v2 concern.

---

## Visual references (separate PDF)

A companion PDF (exported from Visio) accompanies this spec. Treat the PDF as the source of truth for **layout, hierarchy, and the gated-stage pattern**. Treat this markdown as the source of truth for **behavior, sample data, user stories, and the anti-spec**. PDF answers *"what does it look like"*; spec answers *"what does it do and why"*.

The PDF should contain:
- **Sheet 1 — Dashboard mockup** showing all four track sections, the stat tile row, and the header.
- **Sheet 2 — Full lifecycle process flow** — mirror the client's own PDF structure (Sales blue, Ops red, Workshop green, Finance purple, Customer portal yellow/orange) but rendered in the dashboard's visual language.
- **Sheet 3 — Customer portal** — fleet operator's view of their own vehicles.
- **Sheet 4 — Vehicle timeline drill-down** — single vehicle's full history across all tracks.

The client's own process PDF (`DLPE-Digital_Flow_for_DEMO.pdf`) is the authoritative source for which stages exist and how they connect. The design session should treat the client's PDF as ground truth and the spec's stage tables as the digital interpretation of it.

---

## Technical architecture

The frontend Claude designs should assume:
- **Next.js + React** (same stack as the Odoo prototype)
- **Mock REST API** at `/api/*`, swappable later with a real adapter
- **DataSource interface** — single abstraction layer; `MockDataSource` for the demo, real adapters (CRM, PEPPOL, Talend, finance system) added one by one without UI changes
- **Stage definitions are config-driven** — JSON config defines stages, order, lock conditions, CTA labels, SLA days per track
- **Cross-track auto-triggers are explicit** — when a Sales contract signs, the config says "create card in Operations:vehicle_ordered and Finance:invoice_to_make". Not hard-coded.

```typescript
interface StageConfig {
  id: string;
  label: string;
  track: 'sales' | 'operations' | 'workshop' | 'finance';
  order: number;
  lockCondition?: string; // ID of preceding stage that must be complete
  ctaLabel: string;
  slaDays: number;
  triggers?: { track: string; stage: string }[]; // auto-creates cards in other tracks
}
```

---

## How to use this spec in a Claude design session

**Attach to the session:**
1. This markdown spec.
2. The Visio-exported reference PDF (the dashboard mockups).
3. The client's own process PDF (`DLPE-Digital_Flow_for_DEMO.pdf`) — ground truth.
4. The Odoo prototype's `PROJECT_SUMMARY.md` for the technical stack and patterns.

**Then prompt:**

> "Using the attached spec and reference PDFs, scaffold the full intelligence-layer dashboard.
> Build all four track sections (Sales, Operations, Workshop, Finance) on one page, with the stat tile row at the top.
> Use the sample data in the spec. Implement the Sales → Operations auto-trigger when a contract is marked signed.
> Stack: Next.js + React, Tailwind CSS, mock DataSource pattern from the Odoo prototype.
> Also build a separate `/portal` route showing one fleet operator's view (3–4 vehicles, simpler stat tiles).
> Match the visual language in the spec (white background, brand teal, subtle track accent colors, status urgency stripes on cards)."

**For a smaller scoped session:**

> "Using the attached spec, design just the Operations track section in detail.
> Build the stage rail, 6 vehicle cards spanning different sub-flows (new delivery, service due, workshop coordination, replacement vehicle out), and the inline expansion behavior.
> Use the sample Operations data from the spec."

---

## Open questions (resolve before or during the design session)

1. Confirm the pitch target's brand color palette (their site uses a clear primary teal — match exactly, don't go saturated).
2. Confirm which CRM the Sales track imports leads from (the PDF says "Salesforce or other software" — pick one for the demo).
3. Are stage-lock rules absolute (hard block — cannot mark "Offer sent" without a logged meeting) or advisory (warning but proceedable)?
4. How early should the renewal-risk countdown start? 60 days? 90? Confirm with their renewal team.
5. Should the customer portal be a separate URL/subdomain or a `/portal` route under the same app?
6. Which language(s) for the demo UI — English for the pitch, then Dutch/French/German rollout? Or pitch in Dutch from day one?
7. PEPPOL integration: mock the badges only for the demo, or do we have time to wire up a real PEPPOL test endpoint?
