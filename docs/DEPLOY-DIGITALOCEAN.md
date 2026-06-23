# Deploy to DigitalOcean — fully via `doctl` / the API

Everything below is scriptable with the [`doctl`](https://docs.digitalocean.com/reference/doctl/) CLI (the DO API). The app re-deploys automatically on every push to `main`. The app spec lives at [`.do/app.yaml`](../.do/app.yaml).

## What's automated vs. one-time-manual

| Step | How |
|---|---|
| Managed Postgres cluster | `doctl databases create` |
| `il_app` RLS role | `doctl databases user create` (a non-superuser PG user) |
| App + web service + secrets + DB binding | `doctl apps create --spec .do/app.yaml` |
| Schema migrations + first platform admin | the spec's **POST_DEPLOY job** (`prisma migrate deploy` + `bootstrap:admin`) |
| Auto-deploy on `git push` | `deploy_on_push: true` in the spec |
| **DO ↔ GitHub authorization** | **one-time, interactive** (DO dashboard → Settings → link GitHub). Required before `doctl apps create` can pull the repo. |

The only thing the API can't do headlessly is the initial GitHub OAuth link (a security boundary). Everything else is CLI.

## 0. Prerequisites
```bash
brew install doctl                 # or your package manager
doctl auth init                    # paste a DO API token (Account → API → Generate)
# One-time in the DO dashboard: Settings → link your GitHub, grant access to DLPE-Group/DLPE-Digital.
```

## 1. Create the managed Postgres cluster (EU)
```bash
doctl databases create dlpe-pg --engine pg --version 16 --region fra \
  --size db-s-1vcpu-1gb --num-nodes 1
DB_ID=$(doctl databases list --format ID,Name --no-header | awk '/dlpe-pg/{print $1}')
# backups are automatic on managed clusters; confirm/extend retention in the dashboard.
```

## 2. Create the `il_app` RLS role (non-superuser)
```bash
doctl databases user create "$DB_ID" il_app           # prints a generated password
# Grab connection bits for il_app:
doctl databases connection "$DB_ID" --format Host,Port,Database --no-header
```
`il_app` is created as a **non-superuser** DO DB user (so RLS applies to it). Its table
grants are applied by the `app_role` migration when the POST_DEPLOY job runs
`prisma migrate deploy` (the migration's `CREATE ROLE ... IF NOT EXISTS` skips the
already-created user and just runs the GRANTs as the cluster admin/owner).

Build the connection string (note `sslmode=require` — managed PG requires TLS):
```
APP_DATABASE_URL=postgresql://il_app:<il_app-password>@<host>:<port>/<database>?sslmode=require
```

## 3. Fill secrets and create the app
Never commit real secrets — work on a local copy of the spec:
```bash
cp .do/app.yaml /tmp/dlpe-app.yaml
# Replace every REPLACE_ME_* in /tmp/dlpe-app.yaml:
#   APP_DATABASE_URL        → the string from step 2 (in BOTH the web service and the job)
#   JWT_SECRET              → $(openssl rand -hex 32)
#   JWT_REFRESH_SECRET      → $(openssl rand -hex 32)
#   BOOTSTRAP_ADMIN_EMAIL   → your login email
#   BOOTSTRAP_ADMIN_PASSWORD→ a strong password
doctl apps create --spec /tmp/dlpe-app.yaml
```
On create, DO builds the Dockerfile, binds `dlpe-pg` (injecting `${db.DATABASE_URL}`),
starts the web service (which runs `prisma migrate deploy` on boot), then runs the
POST_DEPLOY job → migrations + `bootstrap:admin` → your platform admin exists.

## 4. Use it
```bash
doctl apps list --format ID,DefaultIngress,ActiveDeployment.Phase
```
Open the app's URL, log in with the BOOTSTRAP_ADMIN_* credentials, open the **Control
plane**, and provision real customers from the **`dlpe-starter`** (config-only)
blueprint. The empty `dlpe-demo` placeholder is auto-removed by bootstrap.

## 5. Test-gated auto-deploy on push
The spec sets `deploy_on_push: false`; instead, **GitHub Actions** (`.github/workflows/ci.yml`)
runs the full test suite on every push to `main` and triggers the deploy via
`doctl apps create-deployment` **only when tests pass**. So a red build never reaches
production. Enable it by adding two repo secrets (Settings → Secrets → Actions):

- `DIGITALOCEAN_ACCESS_TOKEN` — a DO API token
- `DO_APP_ID` — from `doctl apps list` after the first `doctl apps create`

First-time push (you're currently local-only, ~85 commits ahead):
```bash
git push origin main      # CI runs tests; on green + secrets set, it deploys
```
(Until those secrets are set, the CI deploy step no-ops and the build stays green.)

## Notes / caveats
- **Secrets in the spec:** `doctl apps create` encrypts `type: SECRET` values on apply. The committed `.do/app.yaml` only has placeholders; keep real values in your filled local copy (or set them later with `doctl apps update` / the dashboard).
- **`APP_DATABASE_URL` is mandatory** in production (boot guard). If it's missing or equals `DATABASE_URL`, the app intentionally refuses to start.
- **Custom domain / TLS:** App Platform issues a default `*.ondigitalocean.app` host with TLS. Add a custom domain in the spec (`domains:`) or dashboard when ready (and set `CORS_ORIGIN` if you split the SPA off).
- **Still simulated:** email (invite links are logged, not sent) and Stripe billing. You can run + onboard via the control plane; wire those before charging money / emailing customers.

## Future optimization — serve the SPA from the free CDN static site

Today the API container serves the built SPA (`app/dist`) itself — simplest, $0 extra,
same origin. When you want faster global load times, split the frontend onto App
Platform's **free Static Site** component (served from DO's global CDN, 3 included free):

- Add a `static_sites:` component that builds the frontend (`npm --workspace app run build`,
  output `app/dist`) and an ingress rule routing `/` → static site, `/api` → the `web`
  service. Same app, same domain → still same-origin, **no CORS**.
- The `web` service then serves only the API, so it can stay comfortably on the
  **$5 (512 MB)** instance.

Trade-off: **cost ≈ neutral** (the SPA is already free inside the container) — this is a
*performance* win (edge caching), not a cost saving. It adds a second build config, so
defer it until global latency actually matters. (The single-container setup is the
current, tested default.)
