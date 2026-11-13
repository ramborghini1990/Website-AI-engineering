# LAUNCH_CHECKLIST.md — before the site goes public (P4.7)

Everything here needs **you** (accounts, registrar, legal sign-off) or a check on the **deployed** site. Nothing below is ticked: as of 2026-11-13 no deployment beyond the Vercel preview exists. Tick an item only after you have seen it work; write the date next to it.

Items tagged **(repo)** are already enforced by code and tests; they only need confirming once on the real URL. Details live in [DEPLOYMENT.md](DEPLOYMENT.md) (hosting, variables, migrations, GitHub rules), [SECURITY.md](SECURITY.md), [GDPR_CHECKLIST.md](GDPR_CHECKLIST.md), [DSR.md](DSR.md), [ROPA.md](ROPA.md), [INCIDENTS.md](INCIDENTS.md). Legal and compliance text in this repo is a draft until a qualified professional has reviewed it (CLAUDE.md §11).

## 0. Stop-ship blockers (from `PROJECT_STATE.md`)

Do not launch while any of these is open.

- [ ] **B2** Fiscal data in `src/lib/business.ts`: P.IVA, REA, PEC (the legal pages and footer print them).
- [ ] **B3** Privacy contact address chosen and used everywhere (privacy notice, footer, `docs/DSR.md`); inquiry retention decided (730 days is the default and only a proposal; if you change `INQUIRY_RETENTION_DAYS`, change the notice with it).
- [ ] **B4** Legal sign-off (see §6).
- [ ] **B5** Vercel **Pro** plan, MFA on every account with access, DPA accepted. Hobby is not allowed for a business site.
- [ ] **B6** Production domain decided.
- [ ] **B8** Final trade name, logo and colours (the name is still a placeholder, `docs/IDENTITY.md`).
- [ ] **B9** About page: biography and technologies per service (`docs/CONTENT.md` §7).
- [ ] **B11** Header at 360 px: navigation moves into a Sheet below `md`.
- [ ] **B13** Services behind the form exist (§4, §5). **B14** Cal.com EU account, or the booking section left off (§5).

## 1. Domain, DNS and TLS

- [ ] Domain registered in your name, registrar account with MFA and auto-renew.
- [ ] Domain added to the Vercel project; apex and `www` resolve; one of them redirects (308) to the other, and the redirect keeps the path. Check with `curl -sI`.
- [ ] `http://` redirects to `https://`; the certificate is issued and valid.
- [ ] **CAA** records: allow only the certificate authority Vercel uses for your domain (read it from Vercel's docs before restricting; a wrong CAA blocks issuance and renewal).
- [ ] **DNSSEC** enabled at the DNS host and the DS record published at the registry. Verify with a DNSSEC checker (a broken chain makes the whole domain unreachable for validating resolvers, so test before and after).
- [ ] `NEXT_PUBLIC_SITE_URL` equals the final origin (§3). Canonical links and `hreflang` in the page source use it.
- [ ] HSTS header present on the deployed site (**repo**). Submit to the browser preload list only if you accept that removal is slow.
- [ ] Domain added to Google Search Console and Bing Webmaster Tools (DNS TXT verification); `/sitemap.xml` submitted.

## 2. Email (inquiry notifications use Resend, `docs/DEPLOYMENT.md` §3)

- [ ] Sending domain added in the provider with the **EU region** chosen (confirm the region option in the provider dashboard; it cannot be assumed).
- [ ] **SPF** record published (the provider's `include:`), only one SPF record on the name.
- [ ] **DKIM** records published exactly as the provider shows; the provider marks the domain verified.
- [ ] **DMARC** record at `_dmarc.<domain>` with `p=quarantine` or stricter, `rua=` pointing to a mailbox you read; move to `p=reject` after a clean month of reports.
- [ ] `EMAIL_FROM` is on that verified domain; `INQUIRY_NOTIFY_TO` is a real inbox.
- [ ] Test: send a real inquiry from Preview-with-production-keys or Production, open the message in a mail client, show the original headers: SPF, DKIM and DMARC all **pass**; the mail is not in spam.
- [ ] The notification carries minimal content (**repo**: `src/lib/inquiry/notification.ts`).

## 3. Vercel Production environment

Names and meanings: [DEPLOYMENT.md](DEPLOYMENT.md) §3. Enter values through the dashboard or the CLI prompt, never in chat or files. Server secrets as **Sensitive**.

- [ ] `NEXT_PUBLIC_SITE_URL` = `https://<final domain>` (`--no-sensitive`, public). Redeploy after changing it: it is baked into the build.
- [ ] `DATABASE_URL` (production EU Postgres, §4).
- [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (production EU database, separate from Preview).
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`: **production** keys for the final hostname, not the Cloudflare test keys.
- [ ] `RATE_LIMIT_IP_SALT`: random, different from Preview and Development.
- [ ] `EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO` (§2).
- [ ] `CRON_SECRET`: random, 32+ characters (the purge job answers 503 without it).
- [ ] `SECURITY_CONTACT`: a mailbox you read (published in `/.well-known/security.txt`).
- [ ] `NEXT_PUBLIC_CAL_URL` only if the EU Cal.com booking page exists; otherwise leave it **unset**.
- [ ] Left **unset or false**: `CSP_MODE` (production enforces), `DEMOS_LIVE_ENABLED=false`, `ANTHROPIC_API_KEY` (live demos are deferred), `CSP_REPORT_URI`, `SENTRY_DSN` (until Sentry is in the registry, ROPA and notice, `DEPLOYMENT.md` §8), `NEXT_PUBLIC_PLAUSIBLE_ORIGIN`.
- [ ] `ENABLE_EXPERIMENTAL_COREPACK=1` on all environments. `SKIP_ENV_VALIDATION` is **not** set anywhere on Vercel.
- [ ] No Preview variable holds a Production secret (Preview: own database branch, own Redis, test keys).
- [ ] First production build log shows Node 24.x and pnpm 12.16.1 (`DEPLOYMENT.md` §5).
- [ ] Functions run in `fra1` (`x-vercel-id` response header).
- [ ] Vercel Analytics and Speed Insights are **off** in the dashboard (**repo**: a test keeps the code free of them).

## 4. Database (EU Postgres)

- [ ] Provider and **region** confirmed as EU; the host is named in `docs/ROPA.md` and the processor list.
- [ ] **Backups** on, with the retention you can state in the ROPA. **Restore tested once** into a scratch database; an untested backup is not a backup.
- [ ] Migrations applied to the **production** database, in order, from a trusted machine (they are plain, idempotent SQL):

  ```bash
  psql "$DATABASE_URL" -f src/lib/db/migrations/0001_create_inquiries.sql
  psql "$DATABASE_URL" -f src/lib/db/migrations/0002_create_demo_event_counts.sql
  psql "$DATABASE_URL" -f src/lib/db/migrations/0003_create_consent_receipts.sql
  ```

  - [ ] `0001` inquiries: without it no inquiry is stored.
  - [ ] `0002` demo event counters: without it `/api/demo-events` answers 503 (demos still work).
  - [ ] `0003` consent receipts: **required**. Without it `/api/consent` answers 503 and **no proof of any cookie choice is kept** (art. 7(1)).
  - [ ] `\dt` in `psql` lists `inquiries`, the demo counter table and the consent receipts table.
- [ ] Database credentials exist only in Vercel and your password manager; the role used by the site cannot create or drop tables if your provider allows a restricted role.
- [ ] After the first real inquiry: the row exists, the email arrived, and repeated submissions from one device are refused with the "too many requests" message (limits: `src/lib/inquiry`).
- [ ] After the first banner choice: `/api/consent` answers 200 and a row appears in the receipts table (no IP, no account link).
- [ ] Cron: Settings → Cron Jobs shows `/api/cron/purge-expired` (03:17 UTC); the first run logs `cron.purge.done` with a count and no data. A 401 or 503 means `CRON_SECRET` or the database is missing.

## 5. Third-party services

- [ ] Upstash: EU region, DPA accepted.
- [ ] Cloudflare Turnstile: production widget for the final hostname; added as a processor in the notice.
- [ ] Cal.com (optional): EU instance (`cal.eu`), event type created, DPA checked. The embed loads only after the visitor clicks (**repo**).
- [ ] Every processor has an accepted DPA, a stated region and a transfer mechanism; US-headquartered ones have a transfer assessment (`GDPR_CHECKLIST.md`).

## 6. Legal and privacy sign-off (B4)

Reviewer: a qualified professional (lawyer or DPO), not this repo.

- [ ] Privacy notice, cookie policy, legal notice and terms (IT and EN) reviewed and approved; "last updated" dates set.
- [ ] Cookie banner wording and the "X means reject" behaviour reviewed against the Garante's 2021 guidelines (**repo**: equal buttons, nothing pre-ticked, six-month memory, withdrawal from the footer, receipts).
- [ ] `docs/DSR.md` (data subject requests) and `docs/ROPA.md` (record of processing) reviewed; the ROPA names the real processors and hosts.
- [ ] The cookie policy table matches what the site really sets: open the deployed site with an empty profile, "Reject all", and look at Application → Cookies and Storage: only the consent cookie and what the policy lists (**repo**: generated from `src/lib/consent/registry.ts`, covered by tests).
- [ ] Demos carry the AI/simulation notice before first interaction (**repo**); they are simulations, no personal data is sent anywhere.
- [ ] Walk through every item of [GDPR_CHECKLIST.md](GDPR_CHECKLIST.md) (60 items, none ticked yet), tick each only after seeing it hold on the deployed site.
- [ ] **Breach procedure** ([INCIDENTS.md](INCIDENTS.md), draft): reviewed, a named decision-maker, the Garante's online notification page bookmarked, the processors' security contacts listed. Anyone who can reach production knows the 72-hour clock.
- [ ] Privacy contact mailbox exists and is monitored; DSR deadline (one month) understood.

## 7. Quality gates (GitHub)

- [ ] `pnpm agent:gate` green on the release commit.
- [ ] **Lighthouse CI green on `main`** (workflow `lighthouse`): every route at performance ≥ 90, accessibility ≥ 95, LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms, script ≤ 300 kB (`lighthouserc.json`, [DEPLOYMENT.md](DEPLOYMENT.md) §4b). Local result on 2026-11-13: met; **not yet seen on a GitHub runner**. After one green run, add `lighthouse` to the required checks.
- [ ] CI (`verify`, `e2e`), `gitleaks` and `pnpm audit (production)` green on `main`.
- [ ] **Branch protection ruleset applied** exactly as [DEPLOYMENT.md](DEPLOYMENT.md) §4b, then its four verification steps done (red check blocks merge; fake secret caught; direct push to `main` rejected). Date and plan recorded there.
- [ ] Dependabot alerts and security updates on; secret scanning and push protection on where the plan offers them.
- [ ] Run the real Lighthouse once against the **production URL** (mobile, in a private window) for the five audited routes, and record the numbers; lab scores on localhost are not field data.
- [ ] Optional external scans once a URL exists: Mozilla Observatory / securityheaders grade, OWASP ZAP baseline (`docs/SECURITY.md`).

## 8. Site checks on the deployed URL

- [ ] `/it` and `/en` render; `/` redirects by language; unknown paths show the localised 404.
- [ ] Each page has one canonical URL and correct `hreflang` pairs (view source on home, services, work, contact).
- [ ] `/robots.txt` allows indexing and lists the sitemap **on production only**; Preview deployments disallow everything (**repo**).
- [ ] `/sitemap.xml` lists the right origin; submitted in Search Console and Bing.
- [ ] Share previews (Open Graph / Twitter card) render for home and a work page (LinkedIn Post Inspector, Facebook Sharing Debugger).
- [ ] `/.well-known/security.txt` is served, its `Expires` is in the future, the contact works.
- [ ] `/api/health` answers `200 {"status":"ok"}` with `cache-control: no-store`.
- [ ] Contact form: submit end to end in Italian and English; the thank-you page shows; the booking link works with and without the embed.
- [ ] First visit in a clean profile: the cookie banner is in the page at once, no third-party request is made before a choice, "Reject all" keeps it that way across navigation.
- [ ] Keyboard-only pass over home and contact; one screen-reader pass over the banner and the form.

## 9. Operations from day one

- [ ] Uptime monitor on `/api/health` with email alert ([DEPLOYMENT.md](DEPLOYMENT.md) §8); alert tested.
- [ ] Vercel spend alerts and budget set, and tested on a low threshold (§8). Anthropic workspace limit only when live demos (P3.0) start.
- [ ] Decision taken on error tracking: Sentry (EU) only after registry, ROPA and notice are updated, otherwise none (§8).
- [ ] A second person (or a printed copy) can reach: registrar, DNS, Vercel, GitHub, database, email provider, password manager. 2FA recovery codes stored offline.
- [ ] Rollback known: promote the previous deployment in Vercel. Migrations are forward-only SQL: a schema change needs its own plan.
- [ ] Logs reviewed after the first day: no error loops, nothing personal in them (**repo**: redacting logger).

## 10. Go / no-go

Launch when §0 is empty, §1–§6 are ticked and dated, §7 is green, and §8 passes on the production URL. Record the date, the commit, the deployment URL and who decided here: ______.

Afterwards: move the launch line into `docs/state/MILESTONES.md`, tag `v1.0.0`, and keep this file as the record. The roadmap calls this file `docs/LAUNCH.md`; this is it.
