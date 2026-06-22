# DLPE Digital

A **generic, multi-tenant entity platform** delivered as SaaS. The core is a configurable meta-model (tracks, stages, entity types, fields) — vehicle/fleet management is just *one* configured use case; the same platform can model bikes, invoices, sales pipelines, or anything else. **Each customer's domain is a blueprint, not code.**

This site is generated with [MkDocs](https://www.mkdocs.org/) and **stays current automatically**: a `pre-commit` git hook regenerates the [Changelog](changelog.md) and the [design specs](reference/specs.md) / [plans](reference/plans.md) indexes on every commit.

## Start here

<div class="grid cards" markdown>

- **:material-docker: Run it locally** — a production-parity Docker stack (≈1:1 with DigitalOcean), with real Postgres RLS tenant isolation. → [Local Docker stack](LOCAL-DOCKER.md)
- **:material-cloud-upload: Deploy it** — DigitalOcean App Platform + Managed Postgres, plus the standing deployment rules. → [Deploy guide](DEPLOY.md) · [Deployment rules](DEPLOYMENT-RULES.md)
- **:material-file-document-multiple: Design history** — every spec and implementation plan, auto-indexed. → [Design specs](reference/specs.md) · [Implementation plans](reference/plans.md)
- **:material-history: What changed** — the full commit history, grouped by date. → [Changelog](changelog.md)

</div>

## Architecture at a glance

- **Multi-tenancy:** every row carries a `tenantId`; Postgres **Row-Level Security** isolates tenants. Request routes run through the non-superuser `il_app` role so the database — not hand-written filters — enforces isolation. (A production boot guard refuses to start if this is misconfigured.)
- **Provisioning:** a customer is stood up from a declarative **blueprint** via an atomic, idempotent provisioning engine — no code deploy per customer.
- **Pluggable seams:** auth, provisioning target (shared DB now / dedicated later), and billing are interfaces, so deferred halves slot in without rewrites.

## Working with the docs

```bash
pip install -r requirements-docs.txt        # one-time (mkdocs + material)
python3 -m mkdocs serve                      # live preview at http://localhost:8000
python3 -m mkdocs build                      # render static site into ./site
python3 scripts/gen_docs.py                  # manually refresh the generated pages
```
