# DEPLOYMENT.md — Vercel (region `fra1`)

Runbook for linking this repository to Vercel and keeping Preview and Production separate. The repo side is done (`vercel.json`, `engines`, `.gitignore`); **steps 1–5 need your Vercel account** and have not been performed. Nothing here has been run against a real Vercel project yet.

Facts below come from the Vercel docs as of 2026-11-04 (links at the end). Where something could not be confirmed it says **unverified**.

## 0. Prerequisites

- **Vercel Pro (or Enterprise), not Hobby.** Hobby is for personal, non-commercial use only; a company business site counts as commercial and risks the deployment being paused. (BLUEPRINT D1 already assumes Pro.)
- MFA on the Vercel and GitHub accounts (GDPR_CHECKLIST: least-privilege access).
- Decide the **production domain** before filling `NEXT_PUBLIC_SITE_URL` (DNS itself is P4.7).

## 1. Create the project and link the repo

Dashboard path: _Add New → Project → Import Git Repository → this repo_, scope = the Pro team, Root Directory `./`, Framework Preset `Next.js`. Grant the Vercel GitHub app access to **this repository only**.

CLI path (no global install; the version is the latest at time of writing, bump it as needed):

```bash
pnpm dlx vercel@65.11.0 login
pnpm dlx vercel@65.11.0 link          # pick the Pro team scope; create/link project "website-ai-engineering"
pnpm dlx vercel@65.11.0 git connect   # connect the GitHub repo if `link` did not
```

`vercel link` writes `.vercel/project.json` (org and project ids). `.vercel` is already in `.gitignore`; do not commit it.

## 2. Project settings

| Setting (Project → Settings) | Value | Why |
|---|---|---|
| Framework Preset | Next.js | also set in `vercel.json` |
| Node.js Version | 24.x | `engines.node` is `24.x` and overrides this; Vercel's default is now a newer major, so keep them equal |
| Function Region | `fra1` (Frankfurt) | `vercel.json` `regions: ["fra1"]` takes precedence and the dashboard setting is then ignored |
| Install Command | from `vercel.json`: `pnpm install --frozen-lockfile` | reproducible installs |
| Production Branch | `main` | production deploys on merge to `main`; every other branch/PR gets a Preview |
| Deployment Protection | keep **Vercel Authentication** on for Preview | previews of a private repo must not be public |
| Web Analytics / Speed Insights | **off** | D6 (cookieless analytics later); GDPR_CHECKLIST §analytics |
| Environment variable `ENABLE_EXPERIMENTAL_COREPACK` | `1`, all environments | lets Vercel honour `packageManager: pnpm@12.16.1` (see risks) |

What `fra1` does and does not cover: it sets where **Vercel Functions** execute. Static pages (everything in the scaffold today) are served from Vercel's global CDN, and request metadata is handled at the edge worldwide. Do not describe the site as "EU-only hosting" in the privacy notice (see §6).

## 3. Environment variables

Source of truth for names: [`.env.example`](../.env.example); the rules are in `src/lib/env-schema.ts` and explained in [SECURITY.md](SECURITY.md) §2. Since P1.7 every variable is validated when the app builds and starts: a malformed value fails `next build` (and a malformed value or half-set group fails at startup), and nothing is *required* yet, so the current deployment works with no variables at all. Each task that adds a consumer moves its variables into `REQUIRED_IN_PRODUCTION`; until then the table below is what to set before that task ships.

Rules:

- Production values never go into Preview or Development. Preview uses its own database branch, its own Redis and **test** keys.
- Values are different per environment, including `RATE_LIMIT_IP_SALT`.
- Variables are entered via the CLI prompt or the dashboard, never on a command line, in a file in the repo, or in chat.
- `NEXT_PUBLIC_*` values are inlined into the browser bundle at **build time**: public data only, and changing one needs a redeploy.
- Server secrets are stored as **Sensitive** (write-only). On the CLI, Production and Preview default to sensitive; pass `--no-sensitive` for `NEXT_PUBLIC_*`.

| Variable | Development (`.env.local`) | Preview | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | leave **unset**: `src/lib/env.ts` (`resolveSiteUrl`, since P1.4) uses Vercel's per-deployment `VERCEL_URL` | `https://<production domain>`; if unset, falls back to Vercel's `VERCEL_PROJECT_PRODUCTION_URL` (needs "Automatically expose System Environment Variables") until the domain is decided |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare test site key | Cloudflare test site key | production widget key |
| `TURNSTILE_SECRET_KEY` | Cloudflare test secret | Cloudflare test secret | production secret |
| `DATABASE_URL` | local or dev EU Postgres | dedicated EU Postgres **branch** for previews | production EU Postgres |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | dev database (EU) | separate preview database (EU) | production database (EU) |
| `RATE_LIMIT_IP_SALT` | random | random, different from prod | random, rotated regularly |
| `EMAIL_API_KEY` | provider sandbox | provider sandbox, no real sends | production key |
| `EMAIL_FROM` | example address | example address | verified sender domain (SPF/DKIM/DMARC, P4.7) |
| `INQUIRY_NOTIFY_TO` | your own inbox | your own inbox, never a client mailbox | real inbox |
| `ANTHROPIC_API_KEY` | empty (simulation) | empty | empty until P3.0, then a dedicated key with a spend cap |
| `DEMOS_LIVE_ENABLED` | `false` | `false` | `false` (kill switch; flip deliberately) |
| `CSP_MODE` | `report-only` (default) | `report-only` (default) | `report-only` first, then `enforce` once a deployment shows no violations (SECURITY.md §4) |
| `CSP_REPORT_URI` | empty | empty | empty unless you run a collector; a third-party collector is a processor (privacy notice) |
| `NEXT_PUBLIC_PLAUSIBLE_ORIGIN` | empty | empty | set only when analytics is wired (P2.6): an origin like `https://plausible.io`, no path |

Build-only setting, deliberately not in `.env.example` because app code never reads it: `ENABLE_EXPERIMENTAL_COREPACK=1`.

CI-only setting: `SKIP_ENV_VALIDATION=1` lets `next build` run in a job that has no secrets (the `verify` job in `.github/workflows/ci.yml` sets it). It is honoured only while `next build` runs and ignored at runtime, so **never set it on Vercel**: there the build should validate, and at runtime it would do nothing anyway.

**Rendering and region (P1.7):** every page is now rendered per request (a nonce-based CSP needs it, SECURITY.md §3), so HTML comes from Vercel Functions in `fra1`, not from the CDN. That also makes the function region observable: check `x-vercel-id` on the first deployed page.

Commands (each prompts for the value; the optional third argument limits a Preview variable to one branch, leave it out for "all preview branches"):

```bash
pnpm dlx vercel@65.11.0 env add NEXT_PUBLIC_SITE_URL production --no-sensitive
pnpm dlx vercel@65.11.0 env add DATABASE_URL production
pnpm dlx vercel@65.11.0 env add DATABASE_URL preview
pnpm dlx vercel@65.11.0 env add ENABLE_EXPERIMENTAL_COREPACK production --no-sensitive   # repeat for preview, development
pnpm dlx vercel@65.11.0 env ls
pnpm dlx vercel@65.11.0 env pull .env.local        # pulls the Development scope; sensitive values come back as placeholders
```

`.env.local` is gitignored and is deliberately unreadable to Claude Code (`.claude/settings.json`).

### The inquiry funnel in a deployment (P2.5)

On Vercel (`VERCEL_ENV` is set) the contact form needs **all** of: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_IP_SALT`, `EMAIL_API_KEY` + `EMAIL_FROM` + `INQUIRY_NOTIFY_TO`. If one is missing the page shows "the form is not available" and the action refuses; nothing is silently mocked. (`REQUIRED_IN_PRODUCTION` in `env-schema.ts` stays empty on purpose: requiring them would fail the build before the services exist.)

Create the table once per database, before the first inquiry (no migration tool is installed; the file is plain SQL and idempotent):

```bash
psql "$DATABASE_URL" -f src/lib/db/migrations/0001_create_inquiries.sql
psql "$DATABASE_URL" -f src/lib/db/migrations/0002_create_demo_event_counts.sql   # demo analytics counters (P3.5, docs/ANALYTICS.md)
psql "$DATABASE_URL" -f src/lib/db/migrations/0003_create_consent_receipts.sql    # cookie-choice receipts (P4.1, art. 7(1))
```

Until `0002` is applied (or without `DATABASE_URL`), a deployed site answers the demo-event endpoint with 503 and drops the events; the demos are unaffected.

Until `0003` is applied (or without `DATABASE_URL`), a deployed site answers `/api/consent` with 503: the visitor's cookie choice still works in their browser, but **no proof of it is kept**, which art. 7(1) requires. Treat `0003` as required before launch, not optional. It also needs `RATE_LIMIT_IP_SALT` (else 503); no other variable. Receipts made on a laptop or in CI live in process memory only.

Email goes through Resend's REST API (`EMAIL_API_KEY`); `EMAIL_FROM` must be on a domain verified with the provider (SPF/DKIM, P4.7). Use the Cloudflare **test** keys in Development and Preview (they are in `.env.example`); only Production gets real ones.

### Sitemap, robots and share images (P2.6)

`/sitemap.xml` and `/robots.txt` are generated at **build time**, so the site URL must be known during the build: set `NEXT_PUBLIC_SITE_URL`, or rely on Vercel's `VERCEL_PROJECT_PRODUCTION_URL` (production) and `VERCEL_URL` (previews), as `resolveSiteUrl` does. A wrong origin there is a wrong sitemap. Only a **production** deployment is indexable: on a preview (`VERCEL_ENV=preview`) `robots.txt` disallows everything and lists no sitemap. After the first production deploy, submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools (that needs your account), and check a page in the Facebook Sharing Debugger, the LinkedIn Post Inspector and a Twitter/X card preview.

### The booking page (P2.7)

Set `NEXT_PUBLIC_CAL_URL` to the public booking page on the **EU instance** of Cal.com (for example `https://cal.eu/<handle>/<event>`); only `cal.eu` and `app.cal.eu` are accepted, so a wrong host fails the build. Create the event type in a Cal.com account on the EU region first. Unset, the contact page simply has no booking section and the CSP has no extra origin. The calendar is embedded only after the visitor clicks; the plain link to the same page is always shown. Add Cal.com as a processor to the record of processing and the privacy notice (P4.2) and check its DPA and the EU data region in your account.

## 4. Readiness checklist

Done in the repo:

- [x] `vercel.json` valid against `https://openapi.vercel.sh/vercel.json` (`framework`, `regions`, `installCommand`)
- [x] `engines.node` = `24.x`, `packageManager` = `pnpm@12.16.1`, `.nvmrc` = `24`
- [x] `pnpm verify` and `pnpm test:e2e` green locally; CI workflows in `.github/` (P0.5)
- [x] `.env.example` lists every variable, placeholders only; `.vercel` and `.env*` are gitignored
- [x] No app code reads env variables yet, so a first deploy needs none

To do in Vercel (you):

- [ ] Pro team, MFA, DPA accepted (see §6)
- [ ] Project created and linked to this repo (§1)
- [ ] Settings in §2 applied, `ENABLE_EXPERIMENTAL_COREPACK=1` set for all environments
- [ ] First deployment: build log shows the intended pnpm and Node versions (§5)
- [ ] Open a PR: it gets a Preview URL behind Vercel Authentication
- [ ] Merge to `main`: Production deploys and serves the scaffold
- [ ] GitHub branch protection requires `verify`, `e2e`, `gitleaks` (and optionally the Vercel check)

## 5. First-deployment checks

1. In the build log confirm **Node 24.x** and **pnpm 12.16.1**.
2. Open the Preview URL while signed in to Vercel; the page renders.
3. Region: the scaffold has no function (both routes are static), so `fra1` cannot be observed yet. Re-check on the first dynamic route (the inquiry handler, P2.5): the deployment's Functions/Runtime Logs view shows the region, and the `x-vercel-id` response header carries it (exact format **unverified**).
4. Confirm Analytics and Speed Insights are off.

## 6. Known risks and fallbacks

- **pnpm 12 on Vercel is unverified.** `pnpm-lock.yaml` has `lockfileVersion: '9.0'`, which Vercel uses to choose a pnpm version when Corepack is not active, and Vercel's docs call Corepack support experimental. Community reports show `packageManager` being ignored in some projects. If the build log shows a different pnpm than 12.16.1: (a) confirm `ENABLE_EXPERIMENTAL_COREPACK=1` is set for that environment; (b) override Install/Build commands in the dashboard with a pinned runner, e.g. `npx pnpm@12.16.1 install --frozen-lockfile` and `npx pnpm@12.16.1 build`; (c) as a last resort, discuss moving the repo to a pnpm major that Vercel supports natively. Do not do (c) silently.
- **Plan lock-in:** Hobby will work technically but breaches its terms for this use.
- **Function regions on plans:** one region (`fra1`) is fine; Vercel's docs disagree on multi-region limits per plan, so check before adding a failover region.
- **Preview URL for `NEXT_PUBLIC_SITE_URL`:** the P1.7 Zod `env.ts` must not make the variable mandatory in Preview, or previews will fail the "missing env" build check. Until P1.7, `resolveSiteUrl` in `src/lib/env.ts` implements the fallback order (explicit variable, Vercel production domain on production deployments, `VERCEL_URL`, localhost) and throws on an invalid explicit value. canonical and hreflang URLs are built from it, so a wrong value is an SEO bug: check the `<link rel="canonical">` of the first production deployment.

## 7. GDPR: Vercel as a processor

Vercel is a processor (hosting, build, CDN, logs). Facts still to be established by you and recorded in `docs/ROPA.md` (P4.3) and `docs/GDPR_CHECKLIST.md` §processors (that line is tagged `[P0.6, P4.2]` and has **not** been ticked):

- DPA accepted in the Vercel account.
- Transfer mechanism, because Vercel is a US company and the edge network is global: EU–US Data Privacy Framework certification and/or SCCs. **Unverified here; check Vercel's current DPA and sub-processor list.**
- Data seen: IP addresses, user agents, URLs, request logs, deployment contents, environment variables.
- Runtime and build log retention and who can access them (GDPR_CHECKLIST §logs). No PII to stdout.
- The privacy notice must describe hosting accurately: functions in Frankfurt, CDN and edge global.

This text is a working note, not legal advice; it needs review by a qualified professional (CLAUDE.md §14).

## Sources

- Corepack and `packageManager`: <https://vercel.com/docs/builds/configure-a-build>
- `regions` in `vercel.json`: <https://vercel.com/docs/functions/configuring-functions/region>
- Node.js versions: <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions>
- Hobby plan and commercial use: <https://vercel.com/docs/limits/fair-use-guidelines>
- Env CLI: <https://vercel.com/docs/cli/env>
- `vercel.json` schema: <https://openapi.vercel.sh/vercel.json>
