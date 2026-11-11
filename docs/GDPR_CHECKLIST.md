# GDPR Technical Checklist — Italy / EU

Scope: the website of the independent AI practice (owner: Ramin Rashidi Alavijeh, Turin), inquiry funnel and public demos. Legal bases referenced: GDPR (Reg. EU 2016/679), D.Lgs. 196/2003 as amended by D.Lgs. 101/2018 (Codice Privacy), ePrivacy Directive Art. 5(3) as implemented in Art. 122 Codice Privacy, **Garante "Linee guida cookie e altri strumenti di tracciamento" (10 June 2021)**, EU AI Act (Reg. 2024/1689) Art. 50 transparency duties.

> This is an engineering checklist, not legal advice. Have the privacy notice, cookie policy and retention periods reviewed by a qualified privacy professional (or a DPO service) before launch.

Legend: ☐ todo · ☑ done · **[P2.5]** = roadmap task that implements it.

---

## 1. Governance documents

- ☐ **Record of processing activities** (Art. 30) in `docs/ROPA.md`: one row per processing purpose (inquiries, booking, analytics, demos live mode, security logs), with data categories, legal basis, retention, processors, transfers. Art. 30(5)'s small-company exemption rarely applies when processing is not occasional, so keep it anyway. **[P4.3]**
- ☐ **Processor list with DPAs** signed/accepted: hosting (Vercel), DB (Neon/Supabase), Redis (Upstash), email (Resend/Brevo), bot protection (Cloudflare Turnstile), booking (Cal.com), analytics (Plausible, if not self-hosted), AI (Anthropic), error tracking (if used). For each: region, transfer mechanism (EU-only, or EU–US Data Privacy Framework certification + SCCs), sub-processor list link. **[P0.6, P4.2]**
- ☐ **Transfer assessment** for every US-headquartered processor, even when data is hosted in the EU (pin EU regions everywhere they're offered). **[P4.2]**
- ☐ **Data breach procedure**: who decides, how to notify the Garante within 72 h (online form), breach log template in `docs/INCIDENTS.md`. **[P4.7]**
- ☐ **DPIA screening** note: the public site is unlikely to require a full DPIA; re-screen if demos ever process visitor-uploaded documents or real social-media data. **[P3.0]**
- ☐ **Privacy contact**: a dedicated address (e.g. privacy@domain) in the notice and footer. **[P1.8]**

## 2. Legal notices on the site

- ☐ **Business identification in footer on every page**: owner and location (built in P1.8, from `src/lib/business.ts`), **Partita IVA** (required on the website by Art. 35 DPR 633/1972), and, where they apply to the legal form, the REA number / Registro Imprese office and PEC. Capitale sociale and the Art. 2250 c.c. disclosures apply to companies, not to an individual practice. **Which items apply depends on the legal form: confirm with your accountant.** The footer shows "not yet available" until the numbers are entered. **[P1.8, B2]**
- ☐ **Informativa privacy** (Art. 13) IT + EN: controller identity and contact, purposes and legal bases per purpose, recipients/processors categories, transfers, retention per purpose, rights (Arts. 15–22) and how to exercise them, right to complain to the Garante, whether providing data is mandatory, automated decision-making (none). Versioned with "last updated" date. **[P4.2]**
- ☐ **Cookie policy** IT + EN: table of every cookie *and* localStorage/sessionStorage/IndexedDB key, with name, provider, purpose, category, duration. Generated from a single `src/lib/consent/registry.ts` so code and policy can't drift. **[P4.2]**
- ☐ **Demo terms / AI notice**: demos are simulations or AI-generated, no reliance, what happens to text typed into live mode. **[P3.0, P4.2]**
- ☐ Links to Privacy, Cookie policy and "Cookie preferences" (reopens the panel) in the footer of every page. **[P4.1]**

## 3. Cookie & tracking consent (Garante 2021 guidelines)

Architecture: custom, first-party consent manager (no third-party CMP script needed for this scope).

- ☐ **Prior blocking**: no non-essential cookie, storage write, pixel, embed or script runs before consent. Enforced by `<ConsentGate category="…">` wrapping every such component; the CSP doesn't allow third-party origins that aren't gated. **[P4.1]**
- ☐ **Categories**: `necessary` (always on: consent receipt, locale, security/Turnstile while you're using a form), `preferences`, `analytics` (only if you use a non-anonymised tool), `marketing` (should stay empty), `embeds` (booking, video, maps).
- ☐ **Banner content**: short notice, link to the cookie policy, **"Accetta tutti" and "Rifiuta tutti" with equal visual prominence**, a "Personalizza" link to granular choices.
- ☐ **Closing the banner with the "X" = reject all non-essential.** No consent by scrolling, by continuing to browse or by pre-ticked boxes. **[P4.1]**
- ☐ **Don't re-show the banner** to someone who refused for at least **6 months**, unless the processing changes materially or you can't know their choice (e.g. storage cleared). **[P4.1]**
- ☐ **Consent receipt** (proof, Art. 7(1)): store server-side `{ consentId (random UUID), choices, policyVersion, timestamp, userAgentFamily }`, **no IP, no account link**. Keep the `consentId` in a first-party necessary cookie. **[P4.1]**
- ☐ **Withdrawal as easy as giving**: "Cookie preferences" link always available; withdrawing deletes the related cookies/storage keys where technically possible.
- ☐ **Embeds click-to-load**: YouTube (use `youtube-nocookie.com` behind a gate anyway), Cal.com, Google Maps (prefer a static map image). **[P2.7]** *P2.7 built (not reviewed by a professional; left unticked): `<ConsentGate>` renders nothing and requests nothing before a click, keeps no cookie or storage, always offers a plain link; Cal.com is the first registered third party (`src/lib/consent/registry.ts`); its disclosure text is draft legal copy. The banner, "reject all" and the consent receipt are P4.1.*
- ☐ Playwright test asserts: zero third-party requests and zero non-necessary cookies on first load; after "Rifiuta tutti" the same holds across navigation; after "Accetta" the gated embeds load. **[P4.1]**

## 4. Analytics privacy

- ☐ Use **cookieless, EU-hosted** analytics (Plausible EU or self-hosted Umami): no cookies, no persistent identifiers, IP not stored. Under the Garante guidelines, analytics that work like technical cookies (aggregate, no cross-site tracking, no re-identification, first-party) don't need consent. Still disclosed in the privacy/cookie notice. **[P2.6 / P3.5]** _P3.5 built it first-party instead (D37, `docs/ANALYTICS.md`): own aggregate counters, no script, no processor; still to disclose in the notice (P4.2) and add to the ROPA (P4.3)._
- ☐ Disable Vercel Web Analytics/Speed Insights, or confirm their current data handling and list them in the notice.
- ☐ Custom events carry **no personal data** (no email, no free text, no query strings containing form data). Strip query strings from tracked URLs.
- ☐ **No GA4, Meta Pixel, LinkedIn Insight Tag** in v1. If ever added: `marketing` category, prior opt-in, Consent Mode v2, transfer assessment, update notices.

## 5. Contact / inquiry / demo forms

> **P2.5 status (built, not reviewed by a professional; the boxes below are left unticked on purpose).** Built: fields name, email, company (optional), need, description, budget band and timeline (the last two have "not decided yet" options); a separate, unticked marketing checkbox, never required, stored with the consent wording version and the time; honeypot + Turnstile (script loaded only on the last step); Zod validation; rate limit by salted hash; EU Postgres via Drizzle with no IP, user agent or token column; plain-text email to the owner; redacting logger; the privacy sentence under the submit button with its Art. 6(1)(b) basis. **Open before launch:** the privacy notice page and its link (P4.2; until then the sentence has no link), naming Cloudflare, the email provider, Upstash and the database host as processors and checking their DPAs and regions, the retention purge (P4.3), and whether the notification email should carry the full inquiry (it does today) or only a pointer, per the "minimal content" line below.

- ☐ **Data minimisation**: required fields = name, business email, message/need. Optional: company, budget band, timeline. No phone unless the visitor wants a call; no date of birth, no free "notes about you". **[P2.5]**
- ☐ **Purpose limitation**: notice under the submit button: "We use these data to answer your request (Art. 6(1)(b) pre-contractual measures). [Informativa privacy]". No consent checkbox needed for answering the inquiry itself.
- ☐ **Marketing/newsletter consent** separate, **unticked**, optional, and not a condition for submitting (Art. 7(4)). Newsletter uses **double opt-in**. **[P2.5]**
- ☐ **Bot protection**: honeypot field + Cloudflare Turnstile (disclose Cloudflare as processor; Turnstile is in the `necessary` category only while used for the form's security). Avoid Google reCAPTCHA. **[P2.5]**
- ☐ **Server-side validation** (Zod), length limits, strip control characters; reject attachments in v1.
- ☐ **Storage**: EU Postgres, encryption at rest (provider default) + TLS in transit; access limited to you; DB credentials only in server env.
- ☐ **Email notifications** via EU-region provider, sent to your inbox, minimal content (or a link to an admin view); SPF/DKIM/DMARC configured. **[P4.7]**
- ☐ **Retention**: inquiries deleted after a stated period (proposal: 24 months from last contact, unless a contract follows; contract data then falls under Italian tax retention of 10 years). Automated purge job (Vercel Cron). **[P4.3]**
- ☐ **Demo funnel prefill** passes the demo scenario id, never personal data, in the URL.

## 6. Logging, monitoring & zero-PII policy

- ☐ **Structured logger** (`src/lib/logger.ts`) with redaction for email, phone, IBAN/fiscal code patterns, names in known fields, authorization headers, cookies. Unit tests prove redaction. **[P1.7]**
- ☐ **Never log** request bodies, form values, AI prompts/responses containing visitor input, raw IPs. Log: request id, route, status, latency, error class.
- ☐ **Rate limiting keys** use `HMAC(ip, rotatingDailySalt)`; Redis keys expire within 24 h. **[P2.5]**
- ☐ **Platform logs**: check Vercel's runtime log retention and who can access them; don't emit PII to stdout. Same for the DB provider's query logs (disable statement logging with parameters).
- ☐ **Error tracking** (optional, EU region): `sendDefaultPii: false`, scrub request data, session replay **off**, breadcrumbs without input values. **[P4.5]**
- ☐ **Processing/audit log** (what the user called "data processing logs"): an append-only `data_events` table recording `{ event: 'inquiry_created' | 'inquiry_deleted' | 'dsr_export' | 'dsr_delete' | 'retention_purge' | 'consent_recorded', subjectRef: hashed id, at, actor }`, never the personal data itself. Lets you show accountability (Art. 5(2)). **[P4.3]**

## 7. Data subject rights

- ☐ Documented procedure in `docs/DSR.md`: requests to the privacy address, identity check proportionate to risk (reply from the same email), answer within **1 month** (Art. 12(3)).
- ☐ Scripts: `pnpm dsr:export <email>` (JSON of all rows for that email) and `pnpm dsr:delete <email>` (deletes inquiry rows, keeps a `data_events` tombstone with hashed ref). Tested. **[P4.3]**
- ☐ Unsubscribe link in every marketing email; one click.

## 8. AI demos (GDPR + EU AI Act)

- ☐ **AI disclosure** (AI Act Art. 50(1), applicable from 2 August 2026): visible before the first interaction with any chatbot-like demo: "Stai interagendo con un sistema di intelligenza artificiale." Mark AI-generated outputs as such. **[P3.0]**
- ☐ **Simulation by default**; live mode opt-in per session, with a short notice: what's sent to the AI provider, not stored by you, don't enter personal data.
- ☐ **No storage** of live-mode inputs/outputs by default. If you want samples for improvement: opt-in, anonymised, short retention, listed in ROPA.
- ☐ **Input guard**: client + server length caps; a simple PII detector (email/phone/fiscal code regex) that warns and masks before sending to the model.
- ☐ **Provider terms**: confirm the Claude API's current data retention and no-training terms for API traffic; add Anthropic to the processor list with its DPA.
- ☐ **No real social-platform data**: Instagram/LinkedIn demos use synthetic personas only; no scraping, no real profile URLs. (Also a platform-terms requirement, see BLUEPRINT §1.)
- ☐ Italy's national AI law (Law 132/2025) adds sector rules and transparency expectations; have counsel confirm whether anything applies to marketing demos.

## 9. Security measures (Art. 32)

- ☐ TLS everywhere, HSTS preload, strict CSP, security headers (see BLUEPRINT §3). **[P1.7, P4.4]**
- ☐ Least-privilege access: separate DB roles for app (insert/select on own tables) vs admin scripts; MFA on GitHub, Vercel, DB, email, domain registrar.
- ☐ Secrets only in Vercel encrypted env vars, separated by environment; preview uses non-production DB branch and test keys.
- ☐ Dependency and secret scanning in CI (Dependabot, dependency-review, CodeQL, gitleaks). **[P0.5]**
- ☐ Backups: provider point-in-time recovery enabled; restoration tested once before launch; backups also honour deletion within the backup retention window (documented).
- ☐ `/.well-known/security.txt` with a contact. **[P4.4]**

## 10. Self-hosted assets (avoid silent third-party transfers)

- ☐ Fonts self-hosted via `next/font` (no runtime requests to Google Fonts; a German court fined a site over dynamic Google Fonts loading in 2022).
- ☐ No third-party CDNs for JS/CSS at runtime; images served from your domain (`next/image`).
- ☐ Icons bundled (lucide), no icon CDN.

## 11. Pre-launch verification

- ☐ Fresh browser, no consent: DevTools Network shows only first-party requests (+ cookieless analytics endpoint if self-hosted on your domain or Plausible EU).
- ☐ Application tab: only necessary cookies/storage keys present, all listed in the cookie policy.
- ☐ Submit an inquiry: check the DB row contains only schema fields; check logs contain no PII.
- ☐ Run `dsr:export` and `dsr:delete` on the test inquiry; verify the tombstone.
- ☐ Privacy notice and cookie policy reviewed by counsel; versions and dates set.
- ☐ ROPA and processor list complete; DPAs on file.
