# Nango AI Integration

_Started 2026-05-29 11:31 UTC_

---

## User

so using Nango open source project how could we approach making a new inteagrion here as its AI driven
https://nango.dev/ 
https://github.com/NangoHQ/nango

## Assistant

_[tool: list_files]_

I'll look at your current project context and research Nango so my answer actually fits what you're building.

_[tool: read_file]_

_[tool: read_file]_

Let me research Nango so I'm accurate about what it actually does today.

_[tool: web_fetch]_

_[tool: web_search]_

Good — I dug into both Nango's repo and how their current model works, and I can map it directly onto what your Intelligence Layer is already doing (those `sources: ['CRM','API','Talend','CSV','PEPPOL']` tags on every card).

## What Nango actually gives you

Nango is an open-source integration platform that supports 800+ APIs and works with any backend language, AI coding tool, and agent SDK. The key shift for an AI-driven build is that you write integration logic as TypeScript functions, or let AI generate them for you, and deploy to Nango's production runtime — Nango handles auth, execution, scaling, and observability.

It reduces to **three primitives**:

1. **Auth** — managed OAuth, API keys, and token refresh for 800+ APIs, embeddable as a white-label auth flow, with Nango handling credentials, token storage, and multi-tenant connection management.
2. **Proxy** — authenticated requests on behalf of a user, where Nango's proxy resolves the provider, injects credentials, handles retries and rate limits, and returns the response.
3. **Functions** — TypeScript functions that call provider APIs, transform data, sync records, process webhooks, or perform actions — generate them with AI, then edit them like normal application code.

The "AI-driven" part is the important bit for you: Nango's AI builder generates TypeScript integration functions from natural language, and unlike black-box solutions you get readable code you can review, edit, and version control. Practically, that means you install the Nango skill into a coding agent (Claude Code, Cursor, Codex, etc.) and describe the integration in plain English — e.g. "build a Nango action that creates an event in the user's calendar." And a `nango dryrun` command runs generated code against a real connection so the agent iterates on real responses instead of hallucinating endpoints.

## How I'd approach a new integration for the Intelligence Layer

Your console is really an **aggregation + action surface** over fleet/sales/workshop/finance systems. Nango fits cleanly if you think of each integration as answering three questions — direction, depth, and source complexity, which is exactly the framing Nango recommends: direction (read, write, or two-way sync?), depth (one or two objects or a large surface incl. custom fields?), and source complexity (a calendar API is simple; CRMs, ERPs and HRIS are not).

Mapping that onto your existing source tags:

| Your source | Nango pattern | Direction |
|---|---|---|
| **CRM** (sales pipeline cards) | **Sync** — pull deals/contacts into card data | Read / two-way |
| **API** (supplier, telematics) | **Sync + Webhook** — order status, delivery ETAs | Read + real-time triggers |
| **PEPPOL** (invoicing) | **Action** — create/send invoice; **Webhook** — receive supplier invoices | Write + read |
| **Talend / CSV** | keep as batch, or replace with a **Sync** to retire the CSV step | Read |

The build loop I'd recommend:

1. **Start from a template, don't write from scratch.** You start from a working integration template, bring it into your codebase via `nango clone`, and iterate from there with AI — Nango currently ships with about a thousand templates. Find the closest provider (e.g. your CRM), clone its sync, then have the agent reshape the output model to match your card schema in `data.js`.
2. **Generate the function, dry-run against a real connection**, refine the field mapping (your cards need `customer`, `value`, `stageId`, `status`, `cta`, etc.).
3. **Wire actions to your card CTAs.** Every card already has a `cta` ("Send dunning notice", "Approve & send to Finance", "Notify fleet operator"). Each of those is a candidate **Nango action** — the exec function kicks off when an action is triggered, takes inputs from the trigger request and returns outputs in the response.
4. **Expose the same actions to your AI/agent layer for free.** You can call functions from your backend, trigger them on schedules or webhooks, or expose selected action functions as tools for AI agents through schemas and MCP. So the "Intelligence Layer" auto-triggers (like your Brussels auto-trigger demo) become deterministic tool calls rather than bespoke glue code.

The strategic payoff for a system like yours: Nango natively supports both custom tool calls and scheduled/on-demand data syncs — you define tool calls for your agent and data sync jobs on the same platform, with shared auth and observability. That's exactly the read-context + take-action split your console needs.

One caveat worth flagging: it's licensed under the Elastic License — you can self-host for free with a limited feature set, so for a regulated fleet/finance product you'll want to check whether the free self-host tier covers what you need or whether you need Cloud/Enterprise.

---

Since I'm your designer here, the natural next step is to **mock the integration experience inside the console** rather than just talk architecture. I could add, as a new view or Tweak-toggled panel in the Intelligence Layer:

- A **"Connections" / integrations screen** — connect a source (the Nango auth flow), see sync status, last-pulled timestamps, per-source health.
- A **"new integration" flow** showing the AI-builder concept: describe in plain English → generated sync/action → field mapping to your card schema → dry-run preview.
- **Source provenance on cards** made richer (which sync produced this card, when it last refreshed).

Want me to design any of those into the existing console? If so, tell me which one and I'll ask a couple of quick questions about scope before building.

## User

so a company like Fraikin what would the early cost be ?

## Assistant

Let me pull Nango's current pricing so the numbers are grounded rather than guessed.

_[tool: web_fetch]_

Good question — and the answer is probably **a lot lower than you'd expect**, because of how Nango bills.

## The key insight first

Nango's main meter is **connections**, and a connection is one authorized external account, not one of your assets. Their definition: *"each connection represents one authorized user account (for example, one user's Salesforce account)."*

Fraikin isn't a multi-tenant SaaS reselling to thousands of customers — they'd be connecting **their own back-office systems** into the Intelligence Layer: their CRM, their ERP/leasing system, a telematics provider, a PEPPOL access point, a few supplier APIs. That's a **handful to a few dozen connections**, not 60,000. So the 60k-vehicle fleet size does *not* drive the connection bill.

## The plans

| Plan | Price | For |
|---|---|---|
| Free | $0/mo | testing |
| Starter | from $50/mo | small teams |
| Growth | from $500/mo | growing teams |
| Enterprise | Custom | custom needs |

Each tier bundles allowances, then meters overage:
- **Connections:** 10 / 20 / 100 included by tier, then **$1 per connection/mo**
- **Proxy requests:** 100k / 200k / 1M included, then **$0.0001/request**
- **Function runs:** 100k / 200k / 1M included, then **$0.0001/run** (+ compute time billed by the millisecond)
- **Sync storage:** 100k / 200k / 1M records included, then **$0.0001/record**
- **API webhooks:** then **$0.0001/webhook**

## Early-phase estimate for Fraikin

A pilot — say **CRM sync + PEPPOL invoice action + one supplier/telematics feed**:

- **Connections:** ~5–20 internal systems → sits *inside* the included allowance. ~$0 overage.
- **Plan:** the deciding factor isn't usage, it's **features**. Starter gets you 2 environments and basic metrics. To get isolated dev/staging/prod, branded UI, and faster new-API turnaround you need **Growth**.

**Realistic early monthly platform cost: ~$50–$500/mo**, landing at **$500/mo (Growth)** once you want proper environments and support. Usage overages in a pilot are negligible.

## What pushes the number up

Two things, neither of which is "early":

1. **Scale of synced data.** 60k vehicles × records (status, service history, invoices) can cross the 1M-record sync-storage line and add metered runs/webhooks. Still likely low-hundreds-to-low-thousands of dollars/month at full fleet volume — variable, not fixed.
2. **Enterprise requirements.** A regulated fleet-finance operation will eventually want **SAML SSO, RBAC, SLAs, log export, and possibly self-hosting** — those are Enterprise-tier (custom pricing) or add-ons. That's the real budget conversation, but it comes *after* the pilot proves value.

## The cost that actually matters

The platform fee is the small part. The bigger line item is normally **engineering time to build and maintain integrations** — and that's exactly what the AI-driven approach compresses. As a reference point, Nango's own team reported generating ~200 integrations across 5 APIs in about 15 minutes for under $20 in token costs — work that previously took an engineer roughly a week. Your team won't hit that ratio on messy enterprise systems (ERP/leasing platforms have undocumented quirks), but the direction is the same: the heavy historical cost of integration work drops sharply.

---

**Bottom-line for an early Fraikin build:** budget roughly **$500/mo for the Nango platform** during the pilot (Growth tier, connections well within allowance), plus your team's build time — materially reduced by the AI builder. The step-up to Enterprise pricing only arrives when SSO/RBAC/SLA/self-hosting and full-fleet sync volume come into scope.

One caveat: these are list prices I pulled from Nango's pricing page today — Enterprise is quote-only, and self-hosting the open-source version (free tier, limited features) is a separate path if data residency is a hard requirement for the leasing/finance data.

Want me to turn this into a **one-page cost & rollout slide** for the Fraikin pitch, or design the **integrations/connections screen** into the console so the proposal has something visual behind it?

## User

seems like this at scale is too expensive.... would it not be better to build a framework ourselves and just copy the code  ?

## Assistant

It's the right question to ask — but "build it ourselves and copy the code" actually blends two very different options, and there's a third one sitting between them that's probably the real answer. Let me separate them honestly.

## There are three options, not two

| | Nango Cloud | **Self-host open-source Nango** | Build your own framework |
|---|---|---|---|
| License cost | metered ($500/mo+) | **$0** | $0 |
| Infra cost | none | you run it | you run it |
| Auth/token refresh for 800+ APIs | ✅ | ✅ | ❌ you build each |
| Provider templates + AI builder | ✅ | ✅ | ❌ |
| Runtime (retries, rate limits, webhooks, observability) | ✅ | ✅ | ❌ you build it |
| Ongoing maintenance | Nango's problem | shared | **100% yours** |

The middle column is the one you're skipping past. Nango is open source and self-hostable — you can run it on your own infrastructure for free with a limited feature set. That kills the metered cloud bill *and* keeps the leasing/finance data in your own environment, while you keep the auth layer, the runtime, and the ~1,000 provider templates. That's most of the "too expensive at scale" problem solved without writing a framework.

## What "build it ourselves" actually costs

The trap is thinking the cost is the framework code. It isn't — the framework is the cheap part. The expensive part is the **perpetual per-provider treadmill**:

- OAuth flows, token refresh windows, scope formats, and credential storage **differ for every provider** and break silently when they change.
- Retries, rate-limit backoff, webhook ingestion, idempotency, checkpointing, observability — you rebuild all of it, then maintain it forever.
- CRMs, ERPs and leasing/HRIS systems have undocumented behaviours and instance-specific quirks. Every provider you add is a new auth flow, new rate limits, new data model, new failure modes.

For reference, Nango's customers were spending 30–40% of engineering cycles on integration work *before* moving to it. Building your own framework doesn't remove that cost — it puts it permanently on your payroll. You'd be trading a predictable ~$500–few-thousand/mo bill for one or two engineers' salaries indefinitely.

## The license catch — this is the one that matters for DLPE

Nango is under the **Elastic License**, not MIT/Apache. That's fine if you're running it **internally for one operation like Fraikin** — you can self-host freely.

But if DLPE's plan is to build a **reusable integration platform you resell to multiple fleet clients**, "copy the code" gets dangerous: the Elastic License specifically restricts offering the software's functionality as a managed service to third parties. That scenario needs either a commercial/enterprise agreement with Nango, or a genuinely clean-room build of your own. Worth getting clear on **which business you're in** before anyone forks anything — it changes the whole calculus.

## My honest recommendation

- **Internal tool for Fraikin (and similar one-off engagements):** self-host open-source Nango. Near-zero license cost at scale, data stays in-house, you keep the auth/runtime/templates. This is almost certainly the sweet spot.
- **Build your own framework only if:** you need to resell it as a product (license forces your hand), *or* your integration surface is tiny and stable (3–4 simple APIs that never change) — in which case a thin in-house wrapper genuinely is cheaper than any platform.
- **Nango Cloud:** worth it only when you'd rather pay than run infra and don't have data-residency constraints.

The instinct "this is too expensive at scale" usually points to **self-hosting**, not **rebuilding** — rebuilding is the most expensive option of the three once you count the maintenance years, it just hides the cost in headcount instead of an invoice.

---

Want me to build a **build-vs-buy / TCO decision slide** (3-option matrix, 3-year cost curves, the license fork-in-the-road) you can put in front of the Fraikin stakeholders? That's the kind of thing that settles this debate faster than a doc — and I can match it to the Intelligence Layer's visual style.

## User

what are the. caveeat the we need to face if we selfhost? ....what features a not in that model... anything we are going to miss?

## Assistant

Let me check Nango's self-hosting docs directly so I'm precise about what the free self-host build actually excludes.

_[tool: web_fetch]_

This is the most important thing to get straight, and it means I need to **correct what I told you earlier** — the free self-host tier is far more limited than "most of the value." I dug into Nango's actual self-hosting docs and here's the real picture.

## Free self-host = Auth + Proxy *only*

Nango explicitly describes the free self-hosting option as intended for **hobby projects** — *"lightweight deployments that need Auth and Proxy, without the managed features and support."* Here's exactly what's in and out:

| Feature | Free self-hosted | Enterprise self-hosted / Cloud |
|---|---|---|
| **Auth** (OAuth, token refresh, 800+ APIs) | ✅ | ✅ |
| **Proxy** (authenticated requests) | ✅ | ✅ |
| Observability | Auth + proxy only | Full |
| OpenTelemetry export | ❌ | ✅ |
| **Functions** (sync/action logic) | ❌ | ✅ |
| **Webhooks** (real-time triggers) | ❌ | ✅ |
| **MCP server** (AI agent tool calling) | ❌ | ✅ |
| Customize auth branding | ❌ | ✅ |
| Role-based permissions (RBAC) | ❌ | ✅ |
| SAML SSO | ❌ | ✅ |
| Support SLA | ❌ | ✅ |

## Why this stings for *your* use case specifically

The three things gated out — **Functions, Webhooks, and MCP server** — are exactly the "AI-driven" parts you were excited about:

- **Functions** is where the sync/action *logic* lives. No Functions = no managed runtime for "pull CRM deals into cards" or "send the PEPPOL invoice."
- **Webhooks** is your real-time triggers (supplier delivery confirmed, invoice received). Gone.
- **MCP server** is how AI agents call your integrations as tools. Gone.

So free self-host gives you the **connectivity plumbing** (auth + proxied API calls) but **not the brains or the agent layer**. My earlier "self-host is the sweet spot at ~$0" was wrong for what you actually want to build — I owe you that correction.

## Operational caveats even if you do self-host

Running it yourself isn't free in effort, either. From their deployment docs:

- You operate **5 Node services + Postgres + Redis + Elasticsearch + S3**. That's a real ops footprint, and **auto-scaling isn't provided out of the box**.
- **Encryption gotcha that matters for finance/leasing data:** you must supply your own `NANGO_ENCRYPTION_KEY` — *without it, credentials are stored unencrypted* — and **key rotation is not supported**; change the key later and you break decryption. For regulated fleet-finance data that's a serious key-management constraint to plan around up front.
- The **dashboard is open to anyone with the URL** unless you explicitly enable Basic Auth.
- **Logs UI needs you to host an Elasticsearch cluster** yourself; otherwise logs just go to stdout.
- Enterprise self-hosted, by the way, isn't "free + support" — it's a **fixed annual license + maintenance fee, plus a fraction of the cloud usage fees**, and requires an Enterprise subscription.

## So the options actually look like this

1. **Free self-host (Auth + Proxy) + build your own logic layer on top.** This is the genuinely interesting one for your cost concern: let Nango handle the part that's truly painful and rots fastest — **OAuth + token refresh across every provider** — and write your sync/action/trigger logic in *your own* backend, calling Nango's proxy for authenticated requests. You sidestep the Functions/Webhooks/MCP gating because that logic runs in your app, not Nango's runtime. You give up the managed runtime (scheduling, retries, observability), the AI builder convenience, and the turnkey MCP server — you'd build those.
2. **Enterprise self-hosted** — everything in-house, but annual license + fees.
3. **Nango Cloud** — metered, no infra.
4. **Full build-your-own** — including the auth layer you'd otherwise get free.

## My honest take now

The "too expensive at scale → just self-host" path **doesn't hold** the way I first implied, because the free tier can't run the integration logic. The real decision is narrower:

- If the **auth/token-refresh treadmill** is your biggest pain (it usually is), **Option 1** is the smart hybrid — take Nango's free Auth+Proxy and own the orchestration yourself. You skip rebuilding the nastiest 30–40% of integration work while keeping costs near zero and data in-house.
- If you want the managed runtime, webhooks, and MCP server without metered cloud billing, that's **Enterprise self-hosted — and it's a paid annual contract**, not free.

---

Given this, I think the cleanest deliverable is a **corrected build-vs-buy slide** with these four options, an honest "what you keep / what you rebuild" column for each, and the free-tier feature cliff called out explicitly — so the Fraikin stakeholders decide with the real constraints in front of them, not the rosy version. Want me to build that?

