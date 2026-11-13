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
| `CRON_SECRET` | unset (no scheduler locally) | unset (Vercel runs crons on Production only) | random, 32+ characters; Vercel Cron sends it as `Authorization: Bearer …` (P4.3) |
| `INQUIRY_RETENTION_DAYS` | unset (730) | unset (730) | unset (730 = 24 months, as the privacy notice says); 30–3650 allowed. Change the notice with it |
| `EMAIL_API_KEY` | provider sandbox | provider sandbox, no real sends | production key |
| `EMAIL_FROM` | example address | example address | verified sender domain (SPF/DKIM/DMARC, P4.7) |
| `INQUIRY_NOTIFY_TO` | your own inbox | your own inbox, never a client mailbox | real inbox |
| `ANTHROPIC_API_KEY` | empty (simulation) | empty | empty until P3.0, then a dedicated key with a spend cap |
| `DEMOS_LIVE_ENABLED` | `false` | `false` | `false` (kill switch; flip deliberately) |
| `CSP_MODE` | unset (`enforce`) | unset (`enforce`) | Leave unset: production enforces. `report-only` only as a temporary rollback; `off` is ignored in production (SECURITY.md §4) |
| `SECURITY_CONTACT` | optional | optional | The address published in `/.well-known/security.txt`; set it to a mailbox you read (without it the file points to the contact page only) |
| `CSP_REPORT_URI` | empty | empty | empty unless you run a collector; a third-party collector is a processor (privacy notice) |
| `SENTRY_DSN` | empty | empty | empty until Sentry (EU) is in the registry, ROPA and privacy notice; then the EU DSN `https://<key>@o<id>.ingest.de.sentry.io/<project>`. Any other host fails the build (§8) |
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

### Scheduled purge of expired inquiries (P4.3)

`vercel.json` has one cron: `GET /api/cron/purge-expired` daily at 03:17 UTC. Before launch:

1. Set `CRON_SECRET` (Production, Sensitive, 32+ random characters). Vercel sends it as `Authorization: Bearer <value>` on its own; no header to configure.
2. Without it the route answers 503 and deletes nothing (it logs `cron.purge.unconfigured`); with a wrong or missing header it answers 401. A deployed site without `DATABASE_URL` answers 503.
3. Vercel runs crons on **Production deployments only**, and the Hobby plan limits them to once a day with hourly precision (B5: Pro plan). Check the first run in the dashboard (Settings → Cron Jobs) and the log line `cron.purge.done` (a count, no data); a `401`/`503` there means step 1 or the database is missing.
4. It deletes `inquiries` rows created more than `INQUIRY_RETENTION_DAYS` (730) days ago and nothing else; **consent receipts are never purged**. Process: [DSR.md](DSR.md) §6.

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
- [ ] GitHub ruleset for `main` applied as in §4b (requires `verify`, `e2e`, `gitleaks`)

## 4b. GitHub: branch protection and required checks (P4.6)

What CI runs, and what you must switch on in GitHub for it to bind. Nothing here can be applied from the repo: it is repository settings (Owner/Admin). Written from the GitHub docs as known on 2026-11-13; labels move, so check each against the UI. A repository ruleset is preferred over classic branch protection; the settings are the same.

**Prerequisite.** Rulesets and branch protection on a **private** repository need a paid plan (Pro/Team); on a public one they are free. If the plan does not allow it, the settings below cannot be enforced and CI only advises.

### The checks (names are the job names; a test keeps them in sync)

| Check (exact name) | Workflow | Runs | Required |
|---|---|---|---|
| `verify` | `ci.yml` | `pnpm verify` (typecheck, ESLint with `--max-warnings=0`, Vitest, `next build`), then `pnpm knip`, then `pnpm format:check` | **Yes** |
| `e2e` | `ci.yml` | `pnpm test:e2e`: Playwright on a production build and on dev (axe, i18n, security headers, flows). Retries 2, `forbidOnly`; a retried pass is reported as flaky | **Yes** |
| `gitleaks` | `security.yml` | pinned, checksum-verified binary; scans full history, `--redact` | **Yes** |
| `pnpm audit (production)` | `security.yml` | `pnpm audit --prod --audit-level moderate`; also weekly | **No** (see below) |
| `lighthouse` | `lighthouse.yml` | Lighthouse CI on the production build, budgets below | **Not yet** (see below) |

`pnpm audit` is deliberately not required: a new advisory against an unchanged lockfile would block every unrelated PR. It still runs on each PR and every Monday, a red result is a to-do (fix, `pnpm.overrides`, or a documented exception), and Dependabot opens the upgrade. The Vercel check may be added as required once the project is linked (§1); it is not needed for the gates above.

### Performance budget (Lighthouse CI)

`lighthouse.yml` builds the site, starts `next start` on port 3300 with the CSP **enforced**, and audits five routes five times each (mobile emulation, simulated slow 4G, Playwright's pinned Chromium): `/it`, `/it/services`, `/it/work`, `/it/work/instagram-lead-agent` (the demo), `/it/contact`. The **median** run must meet every budget in `lighthouserc.json`, or the job fails:

| Budget (each route) | Limit |
|---|---|
| Performance score | ≥ 90 |
| Accessibility score | ≥ 95 |
| Largest Contentful Paint | ≤ 2500 ms |
| Cumulative Layout Shift | ≤ 0.1 |
| Total Blocking Time | ≤ 200 ms (lab proxy for INP) |
| JavaScript transferred | ≤ 300 000 bytes |

Reports (`.lighthouseci/`) are kept as the `lighthouse-reports` workflow artifact for 7 days and are **not** uploaded to Google's temporary public storage. Run it locally with `pnpm build` then `pnpm lighthouse` (set `CHROME_PATH` to a Chromium; `node -p "require('@playwright/test').chromium.executablePath()"` prints Playwright's). The English routes are not audited: same components, one locale is enough for a score.

**Result on 2026-11-13 (local, Windows, median of 5): the budget is met on all five routes** after the P4.7 work: performance 0.99–1.00, accessibility 1.0, LCP 762–915 ms, CLS 0, TBT 81–132 ms, script 232–285 kB (the demo is the heaviest; 15 kB of headroom). Before it (P4.6 baseline): performance 0.73–0.86, LCP 3.6–3.9 s, TBT 237–655 ms, demo 317 kB. What changed and why is in `docs/state/tasks/P4.7.md`.

**Not yet seen on GitHub.** Scores on a runner will differ, and a laptop under load swung TBT by 3–7× between two identical runs (it is a lab metric). So `lighthouse` stays **out of the required list** until it has been green on `main` a few times; then add it (same procedure as above). Two known sources of a flaky result: TBT on the contact page and the demo (typically 100–220 ms, limit 200), and Lighthouse's *simulated* LCP, which in about one run in five jumps to 3+ s on localhost although the browser painted at 0.15–0.45 s (a script ran before the first paint in that run's trace); that is why five runs and the median are used. If a run is red, open the `lighthouse-reports` artifact and re-run once before touching the code. Do not loosen `lighthouserc.json` to get green without a decision recorded in `docs/state/DECISIONS.md`; `ci-workflows.test.ts` pins the floor (90, 95, 2500, 0.1, 200, 300 000, five runs).

### Ruleset for `main` (Settings → Rules → Rulesets → New branch ruleset)

| Setting | Value |
|---|---|
| Enforcement status | **Active** |
| Target branches | Include default branch (`main`) |
| Bypass list | **Empty.** If you need an escape hatch, add *Repository admin* with mode **For pull requests only**, never "Always" |
| Restrict deletions | On |
| Block force pushes | On |
| Require linear history | On (merge by squash or rebase) |
| Require a pull request before merging | On. Required approvals: **0** while you are the only maintainer (GitHub does not let you approve your own PR); raise to 1 with a second maintainer. Dismiss stale approvals: On. Require conversation resolution: On |
| Require status checks to pass | On. Add `verify`, `e2e`, `gitleaks`, each with source **GitHub Actions** (not "any source", so no other app can report a green check under that name) |
| Require branches to be up to date before merging | On (a PR is re-tested against the current `main`; costs one e2e run per rebase) |
| Require signed commits | Optional; only if every contributor has signing set up |
| Require deployments to succeed | Off |

A check can only be picked in the UI after it has run once in the last 7 days: open a PR first, then add the checks. If you ever enable a **merge queue**, add `merge_group:` to the `on:` list of both workflows, or the required checks never report and the queue stalls.

Consequence for the workflow of this repo: with the ruleset on, `git push origin main` is rejected; work goes on a branch and merges through a PR. Dependabot PRs go through the same checks.

### Repository settings that complete it

| Where | Setting |
|---|---|
| Settings → Actions → General → Workflow permissions | **Read repository contents and packages permissions**; "Allow GitHub Actions to create and approve pull requests": **off** |
| Settings → Actions → General → Actions permissions | Allow GitHub-owned actions only (the workflows use `actions/*` only); turn on **Require actions to be pinned to a full-length commit SHA** if the option is shown |
| Settings → Actions → General → Fork pull request workflows | Require approval for all outside collaborators |
| Settings → Code security | Dependabot alerts and security updates **on**; secret scanning and push protection **on** where the plan offers them (public repos, or GitHub Secret Protection) |

### Verify it (30 minutes, once; record the date below)

1. Open a PR that changes nothing risky: the three required checks appear and must pass; merging is blocked until they do.
2. Break one on purpose on a throwaway branch (a lint warning, an unformatted file): the matching check goes red and the merge button stays disabled. Delete the branch.
3. `gitleaks`: on a throwaway branch commit a **freshly invented** high-entropy string in a well-known token format (never a real credential); the check must fail with the value redacted in the log. Close the PR and delete the branch; the string stays in that branch's history only, so use nothing that resembles a live secret.
4. `git push origin main` from your machine is rejected ("protected branch").

**Status:** none of steps 1–4 is done and the ruleset is not applied (needs your GitHub account). Date applied: ______. Plan: ______.

### Maintaining the pins

- Every `uses:` is `owner/repo@<40-hex SHA> # vX.Y.Z`; Dependabot (`github-actions`, Mondays 06:00 Europe/Rome) bumps both. Before merging such a PR, read the release notes of the action; an action runs with the job's token and your checked-out code.
- The gitleaks binary version and SHA-256 are set together in `security.yml` (`GITLEAKS_VERSION`, `GITLEAKS_SHA256`); Dependabot does not see them. Check the releases page when the weekly scan reports an outdated-rules problem or quarterly.
- Runners are pinned to `ubuntu-24.04`, not `ubuntu-latest`: update on purpose when GitHub announces the image's end of life.
- Workflows request `contents: read` at the top level and nothing per job. A job that needs more declares it itself with a comment saying why; `src/lib/ci-workflows.test.ts` fails on any write scope, privileged trigger, unpinned action, job without a timeout, or a PR-controlled value interpolated into a script, so such a change must edit that test in the same PR, in view of the reviewer.
- **Why `gitleaks` was red (P4.7) and what `.gitleaks.toml` is.** The scan reads the whole history, and two *synthetic* strings in the logger redaction tests (`src/lib/logger.test.ts`, commit `0de0289`: a JWT and an `api_key=` pair, there to prove the logger removes secret-shaped text) match the default `jwt` and `generic-api-key` rules, so the job exited 1 on every run since P4.5. They are in pushed history, so rewording the test cannot clear it. `.gitleaks.toml` keeps all default rules and adds two exceptions that each require the exact file, the exact rule **and** the exact value (`condition = "AND"`); the same strings elsewhere, or other secrets in that file, are still reported. Do not add path-only or rule-only exceptions (`ci-workflows.test.ts` rejects them). A real secret in history is fixed by **rotating it**, not by an allowlist. The workflow passes `--config .gitleaks.toml` explicitly, so a missing file fails the job instead of silently dropping the exceptions. The default `gitleaks/gitleaks-action` is not used (it wants a paid licence on organisation repositories); the pinned, checksum-verified binary is free.

## 5. First-deployment checks

1. In the build log confirm **Node 24.x** and **pnpm 12.16.1**.
2. Open the Preview URL while signed in to Vercel; the page renders.
3. Region: the scaffold has no function (both routes are static), so `fra1` cannot be observed yet. Re-check on the first dynamic route (the inquiry handler, P2.5): the deployment's Functions/Runtime Logs view shows the region, and the `x-vercel-id` response header carries it (exact format **unverified**).
4. Confirm Analytics and Speed Insights are off (Project → Analytics, Project → Speed Insights: both *disabled*; the code does not install either, a test guards it). `curl -i https://<host>/api/health` answers `200 {"status":"ok"}` with `cache-control: no-store`.

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

## 8. Observability (P4.5)

What the code does and why it is safe: [SECURITY.md](SECURITY.md) §9. This section is what **you** set up.

### Uptime check

`GET /api/health` → `200 {"status":"ok"}` (also `HEAD`), uncached, nothing else in the body. Point an external monitor at `https://<production host>/api/health`: 1–5 minute interval, alert on any non-200 or a timeout, two locations if the tool offers it, alerts to a mailbox you read (and a second channel). Any EU-hosted or EU-region monitor will do; **the monitor sees only a status code**, but check its DPA anyway, and record it in `docs/ROPA.md` if it is a third party. It deliberately does not touch the database or Redis (SECURITY.md §9), so a green check means "the site answers", not "the form works": watch the `inquiry.*` log lines for that. To test the alert: pause the monitor's target or point a second monitor at `/api/health-does-not-exist` and confirm the alert arrives.

### Error tracking (optional, EU)

Off by default: with `SENTRY_DSN` unset, an unhandled server error produces **one log line** (`request.error`: route pattern, error class, digest, request id) and nothing leaves the server. To switch the tracker on:

1. **Legal first:** add Sentry to the processors in `src/lib/consent/registry.ts` (+ `messages/*.json` legal wording), `docs/ROPA.md` §3 and the privacy notice; accept the DPA. Do **not** set the variable before this: `legal-structure.test.ts` lists `SENTRY_DSN` as "not a service" only while it is unset (B4, legal review).
2. Create the Sentry **organisation** with *Data Storage Location = EU (Frankfurt)*: chosen at creation, not changeable later. Read Sentry's "Data Storage Location" page: it lists data that stays in the US (for example DSN keys).
3. Project settings (names from memory of the Sentry UI, **not re-checked**: find the equivalents if they moved): *Prevent Storing of IP Addresses* on, *Data Scrubber* and *Use Default Scrubbers* on, event retention as short as useful (30 days), no session replay, no performance tracing, no user feedback widget.
4. Copy the DSN (Project → Settings → Client Keys). It must look like `https://<key>@o<number>.ingest.de.sentry.io/<project id>`. Set it as `SENTRY_DSN` in **Production only** (Preview and Development stay empty so test errors do not pollute it). A DSN on any other host fails `next build` by design.
5. **Check by eye**, once (the payload has been tested with a fake `fetch`, never against a live project): on a Preview deployment, temporarily make a route throw an error whose message contains `test.person@example.com 203.0.113.9`, load it, and open the event in Sentry. Expected: type = the error class, value `[message withheld]`, tags `route` (a pattern), `route_type`, `method`, `digest`; frames with file base names; **no** message, URL, headers, user, IP or cookies. If Sentry shows an IP, the IP setting in step 3 is off. Remove the throw.
6. Alerts: Sentry → Alerts → "new issue" to your mailbox. It is the error tracker's own alert, separate from the spend alerts below.

Not covered: errors that only happen in the browser (the error pages do not report, SECURITY.md §9) and errors our handlers catch and answer with a typed result (they are logged by class).

### Spend alerts (Vercel and Anthropic)

An alert tells you; only a hard limit stops the spending. Set both kinds, and test the alert on a low threshold before relying on it.

**Vercel** (Pro plan, B5; Settings → Billing → Spend Management; needs Owner or Billing role). Checked against Vercel's Spend Management docs on 2026-11-12; labels can change.

1. Enable Spend Management and set the **on-demand budget**: start with a figure you would be annoyed, not ruined, by (the site is light: one region, few functions, no images service use).
2. Notifications: web and email at 50 %, 75 % and 100 % are enabled automatically; add SMS (sent at 100 % only) and a second recipient.
3. Turn on **Pause Production Deployments** if you want a stop, not only an alert. Know the trade: a paused production site is an outage (and the uptime check will fire); resuming is manual, per project, and raising the amount does not unpause. Checks run every few minutes, so the real spend can overshoot.
4. Optional webhook (HTTPS POST with `budgetAmount`, `currentSpend`, `thresholdPercent`, signed in `x-vercel-signature`): only if something will consume it; a consumer must verify the signature.
5. **Test:** set the budget to just above the current month's spend (or to the minimum allowed), wait for the next check, confirm the web and email notification arrive, then restore the real figure. Cron at 03:17 UTC and the health probe cost nothing noticeable.

**Anthropic** (Claude Console, only needed once `ANTHROPIC_API_KEY` is set, P3.0 deferred; `DEMOS_LIVE_ENABLED` stays `false` until then):

1. Create a **dedicated workspace** for this site (Console → Settings → Workspaces) and issue the API key **from that workspace**, so its spend is separate. The default workspace cannot have a limit.
2. In that workspace: **Spend limits** → monthly limit (must be below the organisation limit) and an **email notification** at a lower amount (for example 50 % of the limit). At the limit, requests fail with HTTP 400 `invalid_request_error` until 00:00 UTC on the 1st, or until you raise it: when P3.0 is built, the demos must fall back to simulation on any upstream error, including this one.
3. Prepaid credits with auto-reload **off** are a second brake.
4. The app has its own guard (Upstash budget counter, required when `DEMOS_LIVE_ENABLED=true`, `env-schema.ts`); the Console limit is the one that cannot be bypassed by a bug.
5. **Test:** set the notification threshold just above current spend, make one demo call from a Preview with a test key, confirm the email arrives; do not test the hard limit on a production key.

**Status:** none of the four account steps (monitor, Sentry, Vercel budget, Anthropic workspace) is done: they need your accounts. Record the date and the amounts you chose here when done.

## Sources

- Corepack and `packageManager`: <https://vercel.com/docs/builds/configure-a-build>
- Vercel Spend Management: <https://vercel.com/docs/spend-management>
- Anthropic workspaces and spend limits: <https://platform.claude.com/docs/en/manage-claude/workspaces>
- Sentry data storage location: <https://docs.sentry.io/organization/data-storage-location/>
- `regions` in `vercel.json`: <https://vercel.com/docs/functions/configuring-functions/region>
- Node.js versions: <https://vercel.com/docs/functions/runtimes/node-js/node-js-versions>
- Hobby plan and commercial use: <https://vercel.com/docs/limits/fair-use-guidelines>
- Env CLI: <https://vercel.com/docs/cli/env>
- `vercel.json` schema: <https://openapi.vercel.sh/vercel.json>
