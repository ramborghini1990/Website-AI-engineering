# ROPA.md — record of processing activities (art. 30 GDPR)

One row per processing activity of the site, as the code does it on **2026-11-12** (P4.3). The small-business exemption in art. 30(5) rarely applies when processing is not occasional, so the record is kept. Engineering record, **not legal advice**: every **TO CONFIRM** needs the owner or the B4 legal review. Kept in step with the privacy notice, the cookie policy and `src/lib/consent/registry.ts` (a test fails if a service in the code is missing there). Request handling and deletion: [DSR.md](DSR.md).

## 1. Controller

| Field | Value |
|---|---|
| Controller | The owner of the practice named in the footer (`src/lib/business.ts`); fiscal data pending (B2), trade name pending (B8) |
| Contact for privacy matters | Privacy address pending (B3); the contact form until then |
| Data protection officer | None appointed (statement in the draft notice, TO CONFIRM) |
| Joint controllers | None |
| Representative in the EU | Not needed: controller established in Italy |

## 2. Activities

| # | Activity | Purpose | Data subjects | Data | Legal basis | Retention | Recipients / processors | Transfers outside the EEA |
|---|---|---|---|---|---|---|---|---|
| 1 | **Inquiries** (contact form → `inquiries` table, notification email) | Answer a request for a quote or a call | People writing through the form | Name, email, company (optional), type of need, description, budget band, timeline, page language; status (`new`, `replied`, `closed`) | Pre-contractual steps at the person's request, art. 6(1)(b) | **730 days (24 months) from creation**, then deleted by the daily purge (`INQUIRY_RETENTION_DAYS`, `/api/cron/purge-expired`); sooner on an erasure request. The notification email copy is deleted by hand (DSR.md §4) | EU Postgres host (name pending, B13); Vercel (runs the code); Resend (sends the notification, holds a send log: retention TO CONFIRM) | See §3 |
| 2 | **Marketing choice** (optional box in the form, stored with the inquiry) | Prove the optional consent to news (art. 7(1)) | Same | The yes/no, the version of the consent text, the time (`marketing_consent`, `consent_version`, `created_at`) | Consent, art. 6(1)(a) | Same row as 1, so **also purged at 730 days**, although the notice says "until you withdraw". No list sends anything today; a newsletter would need its own consent record | EU Postgres host | See §3 |
| 3 | **Form protection** (honeypot, Turnstile, rate limit) | Keep the form from abuse | Visitors using the form | Turnstile: token and the signals the provider reads, at the moment of sending. Rate limit: a code derived from the IP with a secret salt (the raw IP is not stored), window 10 minutes, 5 requests | Legitimate interest in protecting the site, art. 6(1)(f) | Limiter keys expire with the window (10 minutes); Turnstile: the provider's own | Cloudflare (Turnstile, loaded only on the last form step); Upstash (EU Redis, limiter) | See §3 |
| 4 | **Cookie choice receipts** (`consent_receipts` table) | Be able to show a visitor's cookie choice (art. 7(1)) | Visitors who use the banner | Random code, time, banner-text version, method (accept all / reject all / custom / close), calendar choice. **No IP, no browser, no account, no email**: not linkable to a person without the code the visitor holds | Legal obligation to demonstrate consent, art. 6(1)(c) with art. 7(1) (TO CONFIRM; legitimate interest is the alternative) | **Kept; no purge exists on purpose.** The period is not decided (B4). Never touched by the DSR tools or the purge | EU Postgres host | See §3 |
| 5 | **Booking a call** (Cal.com, only after the visitor allows it) | Schedule a conversation | Visitors who book | What the visitor enters on the calendar's own page, under that provider's notice | Consent to load the calendar, art. 6(1)(a); the booking itself: pre-contractual steps, art. 6(1)(b) | In the Cal.com account: delete by hand on the same rhythm as 1 (TO CONFIRM) | Cal.com EU instance (its role, processor or independent controller, TO CONFIRM) | EU instance; TO CONFIRM |
| 6 | **Technical operation** (hosting logs) | Run and protect the site | All visitors | IP, browser, page, time, in the host's logs. The site's own logs hold event, route, status, duration and request id only, with personal-looking text redacted (`src/lib/logger.ts`) | Legitimate interest, art. 6(1)(f) | The host's log retention: TO CONFIRM (GDPR_CHECKLIST §6) | Vercel | See §3 |
| 7 | **Demo usage counters** (`demo_event_counts`) | Know which demos get used | Visitors who use a demo | A counter per day, demo and event. No row per visitor, no id, no IP, nothing finer than the day | Not personal data if anonymous; if ever challenged, art. 6(1)(f) | Indefinite (aggregate) | EU Postgres host | See §3 |
| 8 | **Live AI demos** (Anthropic) | Show the demos with a real model | Visitors who use one | **Inactive today** (`DEMOS_LIVE_ENABLED=false`, demos run as simulations with no network) | n/a until switched on | n/a | Anthropic, only if live mode is enabled | US; a data-processing agreement and an assessment first |
| 9 | **On-device storage** (consent cookie, `theme`, demo data in the browser) | Remember the choice, the theme, the demo's own data | All visitors | Stays in the visitor's browser; the cookie also holds the receipt code | Strictly necessary, no consent needed (art. 122 Codice Privacy) | Cookie: 6 months for a rejection (cookie policy), others as listed in the cookie policy | None | None |

## 3. Processors and transfers

Print of `src/lib/consent/registry.ts` → `processors`. Region and safeguard wording per processor is in `messages/*.json` → `legal.processors.*`; **every DPA and every transfer mechanism is TO CONFIRM** before launch (B4, B5, B13).

| Processor | Role | When data reaches it | Established | Safeguard to document |
|---|---|---|---|---|
| Vercel Inc. | Hosting | Every visit | US company; functions in Frankfurt (`fra1`), static files from a global CDN | DPA; EU–US Data Privacy Framework or SCCs (TO CONFIRM); plan and MFA (B5) |
| PostgreSQL host (EU) | Database | Contact form, receipts, counters | Name pending (B13) | DPA; EU region; backup retention to record |
| Upstash | Rate limit | Contact form | EU Redis region | DPA; TO CONFIRM |
| Cloudflare (Turnstile) | Bot protection | Last form step | US company | DPA; DPF or SCCs (TO CONFIRM) |
| Resend | Email | Contact form (the notification) | TO CONFIRM (region of sending) | DPA; DPF or SCCs (TO CONFIRM) |
| Cal.com (EU instance) | Booking | After the visitor allows it | EU instance | Role and DPA (TO CONFIRM) |
| Anthropic | AI | Only if live demos are enabled (off) | US | DPA and assessment before enabling |

## 4. Security measures (art. 32, summary)

Strict CSP and security headers; secrets only in server environment variables, validated at build and start; every input parsed with Zod before use; rate limit and bot check before storing; zero-PII logger with an allow-list of fields; TLS in transit; encryption at rest by the database provider (TO CONFIRM); access to the database limited to the owner; the scheduled job only answers a caller with `CRON_SECRET` (constant-time check); the DSR tools need `DATABASE_URL` and print counts only. Details: [SECURITY.md](SECURITY.md), [GDPR_CHECKLIST.md](GDPR_CHECKLIST.md).

## 5. Change log and review

Review this record when a service, a field or a retention period changes, and at least once a year. A change to any of those updates, in the same commit: the code, this record, the privacy notice, the cookie policy (the tests cover the registry side) and DSR.md.

| Date | Change |
|---|---|
| 2026-11-12 | First version (P4.3): activities 1–9 from the code; inquiry retention 730 days; receipts kept |

## 6. Gaps found while writing it

- The notice says inquiries are kept "24 months from the last contact"; the table stores only the creation date, so the purge counts from the first contact. Reword the notice (B4) or add a date column.
- The notice says the marketing choice is kept "until you withdraw", but it lives in the inquiry row and is purged with it (activity 2).
- Retention of receipts, of the request register, of the provider logs and of backups is not decided.
