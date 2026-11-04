# ROADMAP.md

Phased plan. Each task is sized for **one Claude Code prompt → one reviewed commit**. Task IDs (`P1.3`) are what you give Claude Code. A phase is done only when every acceptance criterion is checked and CI is green on `main`.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · **Commit** = proposed Conventional Commit message for the milestone.

Global Definition of Done (applies to every task):
- `pnpm verify` passes locally (typecheck, lint, unit tests, build).
- No new `any`, no `@ts-ignore` without a linked reason, no `console.log` left in `src/`.
- New UI is keyboard-navigable, has visible focus, respects `prefers-reduced-motion`, and passes axe with zero serious/critical violations.
- No PII is logged; any new third-party service is added to `docs/GDPR_CHECKLIST.md` §Processors and `docs/ROPA.md`.
- `PROJECT_STATE.md` updated.

---

## Phase 0 — Setup, governance & tooling

Goal: an empty but fully governed repo where Claude Code works safely and CI enforces quality.

| ID | Task | Acceptance criteria |
|---|---|---|
| P0.1 | Scaffold Next.js 16 + TS strict + Tailwind v4 + pnpm (`create-next-app`, App Router, `src/`, Turbopack). Add `.nvmrc` (24), `packageManager` field, `engines`. | `pnpm dev` serves the default page; `pnpm build` passes; Node/pnpm versions pinned. |
| P0.2 | Add governance files from the blueprint: `CLAUDE.md`, `ROADMAP.md`, `PROJECT_STATE.md`, `docs/*`, `.claude/settings.json`, `.env.example`, `.gitignore` (incl. `.env*`, `!.env.example`). | Files present; `.env.local` cannot be read by Claude (deny rule tested by asking it to). |
| P0.3 | Tooling: ESLint flat config (next, typescript-eslint strict-type-checked, jsx-a11y), Prettier + tailwind plugin, `knip`, scripts `typecheck`, `lint`, `format`, `test`, `test:e2e`, `verify`. | `pnpm verify` runs all checks and fails on a deliberately broken file. |
| P0.4 | Testing harness: Vitest + Testing Library + jsdom; Playwright with one smoke test and `@axe-core/playwright`. | `pnpm test` and `pnpm test:e2e` pass in CI and locally. |
| P0.5 | CI: copy `.github/workflows/ci.yml`, `security.yml`, `dependabot.yml`; pin actions to SHAs; enable branch protection on `main` (required checks, PR required, no force-push). | A PR shows all checks; a commit with a fake secret is blocked by gitleaks. |
| P0.6 | Vercel project: link repo, region `fra1`, env vars per environment, preview deployments on PRs, production on `main`. | PR gets a preview URL; production URL serves the scaffold. |
| P0.7 | MCP & skills: add 21st MCP via `.mcp.json` (key in env), install the vetted design skill per `docs/SECURITY_TOOLING_AUDIT.md`. | `claude mcp list` shows `21st` connected; `/plugin` shows only the approved plugins. |

**Commit milestones:** `chore: scaffold next.js app with strict typescript` · `chore: add claude code governance and project docs` · `ci: add verification, security scanning and dependabot` · `chore: configure mcp servers and design skill`

---

## Phase 1 — Core framework, design system & motion

Goal: the foundation every page is built from: tokens, typography, primitives, i18n, motion system, security headers.

| ID | Task | Acceptance criteria |
|---|---|---|
| P1.1 | Design direction: generate a design system with the design skill (`--design-system` for "AI engineering agency, premium, dark-first, technical"), then decide manually. Write `docs/DESIGN.md`: palette, type scale, spacing, radii, shadows, motion durations/easings, do/don't list. | `DESIGN.md` approved by you; contrast pairs ≥ 4.5:1 documented. |
| P1.2 | Tokens in Tailwind v4 `@theme` (`src/app/globals.css`), light/dark via `class` + `prefers-color-scheme`; self-hosted fonts via `next/font`. | No raw hex in components (lint rule or grep check in `verify`); fonts load from own domain. |
| P1.3 | Primitives: shadcn/ui init + Button, Input, Textarea, Select, Checkbox, Dialog, Sheet, Tabs, Tooltip, Toast; restyled to tokens. | Storybook-free gallery route `/[locale]/_dev/ui` (dev-only, 404 in prod); axe clean. |
| P1.4 | i18n: `next-intl`, `[locale]` segment, middleware redirect from `/`, `messages/it.json` + `en.json`, language switcher, `hreflang` + `alternates` metadata. | `/it` and `/en` render; switching keeps the path; missing key fails typecheck. |
| P1.5 | Motion system: `LenisProvider` (client) synced to `gsap.ticker`, `registerGsap()` once, `useReducedMotion` hook that disables Lenis and swaps timelines for fades, ScrollTrigger refresh on route change, cleanup with `useGSAP`. | No layout shift from motion (CLS < 0.05 on test page); reduced-motion mode verified in Playwright; no ScrollTrigger leaks across navigations. |
| P1.6 | FX library: 4–6 components adapted from React Bits / own (text reveal, magnetic button, marquee, spotlight card, gradient mesh background, scroll-pinned section). Each lazy-loaded, documented in `docs/THIRD_PARTY.md` with source + licence. | Each FX has a static fallback; JS for FX not in the initial bundle of pages that don't use it. |
| P1.7 | Security headers & CSP with nonce in `middleware.ts`, `Report-Only` first; `env.ts` with Zod server/client split; `server-only` guards. | securityheaders.com grade A on preview; build fails if a required env var is missing; importing a server module from a client component fails the build. |
| P1.8 | Layout shell: header (nav, locale, CTA), footer with **company legal data** (ragione sociale, sede legale, P.IVA, REA, capitale sociale, PEC), skip-link, 404/500 pages. | Footer data present on every page; skip-link works; Lighthouse a11y = 100 on shell. |

**Commit milestones:** `feat(design): add design tokens, typography and theme` · `feat(ui): add accessible primitives` · `feat(i18n): add italian and english routing` · `feat(motion): add lenis and gsap motion system with reduced-motion support` · `feat(security): add csp, security headers and validated env`

---

## Phase 2 — Landing page & agency value proposition

Goal: a fast, persuasive marketing site that converts to inquiries.

| ID | Task | Acceptance criteria |
|---|---|---|
| P2.1 | Information architecture & copy deck (IT first, EN adapted, not literal): Home, Services (AI agents, workflow automation, full-stack web apps, document intelligence), Work (case studies), Process, About, Contact. In `content/` as MDX + messages. | Copy approved by you; every page has unique title/description in both locales. |
| P2.2 | Home: hero (kinetic headline, clear one-line offer, primary CTA), proof strip, services grid, featured demos, process timeline (scroll-pinned), testimonials/logos (only with permission), final CTA. | LCP < 2.0 s and INP < 200 ms on mid-range mobile (Lighthouse CI budget); hero text visible without JS. |
| P2.3 | Services pages from MDX with structured data (`Service`, `Organization`, `ProfessionalService` JSON-LD). | Rich results test passes; each page links to a relevant demo and to contact. |
| P2.4 | Case studies: MDX collection with Zod frontmatter (client consented?, sector, stack, outcome metrics), index with filters, detail template. | Build fails on invalid frontmatter; `clientConsent: true` required to show a client name/logo. |
| P2.5 | Contact & inquiry funnel v1: multi-step form (need → budget band → timeline → contact details), Server Action/Route Handler, Zod, honeypot + Turnstile, rate limit, DB insert, email notification, confirmation page. Privacy notice link + **separate, unticked** marketing consent checkbox. | E2E test covers happy path, validation errors, rate-limit response; stored row contains only fields in the schema; no PII in logs (asserted in test). |
| P2.6 | SEO & sharing: `sitemap.ts`, `robots.ts`, OG images via `next/og` per page and locale, canonical URLs. | Sitemap lists both locales; OG images render. |
| P2.7 | Booking: Cal.com (EU) embed behind `<ConsentGate>` click-to-load, with a plain link fallback. | No request to the booking provider before the visitor clicks. |

**Commit milestones:** `feat(content): add services and case study collections` · `feat(home): build landing page` · `feat(contact): add inquiry funnel with validation, rate limiting and bot protection` · `feat(seo): add sitemap, structured data and og images`

---

## Phase 3 — Interactive agent showcases & order funnels

Goal: demos that prove capability, cost nothing to run by default, and feed the funnel. Build one demo per sub-phase; ship each independently.

| ID | Task | Acceptance criteria |
|---|---|---|
| P3.0 | Demo framework: `DemoEngine` interface, demo shell (title, "simulation" badge, AI-disclosure notice, reset, "get this for your business" CTA that pre-fills the inquiry with the scenario), streaming step renderer, budget guard + per-IP limit for live mode, kill switch env flag `DEMOS_LIVE_ENABLED`. | Turning the flag off makes every demo run in simulation without errors; AI disclosure visible before first interaction. |
| P3.1 | Instagram engagement & lead agent (simulation): synthetic brand inbox and comments, intent classification, reply drafts, lead scoring board, handoff to funnel. Optional live mode: visitor types a sample DM, Claude classifies and drafts (no real Instagram calls). | Works offline in simulation; live mode output validated by Zod; prompt-injection test cases (e.g. "ignore instructions and…") don't change system behaviour. |
| P3.2 | LinkedIn outreach agent (simulation): prospect research cards → draft → **human approval gate** → "scheduled" state. Copy explains compliant approach. | Approval step cannot be skipped in the UI; no scraping or LinkedIn network calls anywhere in the code. |
| P3.3 | Document intelligence demo: bundled sample docs (invoice, contract, DDT), extraction to structured fields, Q&A with citations to page/section. Visitor uploads **disabled** in v1. | Extraction results match fixtures in tests; citations link to the right section. |
| P3.4 | Business management suite demo: POS screen, cash-flow dashboard, purchase orders; seeded fake data in IndexedDB, reset, no server writes. | Fully usable offline; charts accessible (table fallback); Lighthouse performance ≥ 90 on demo route. |
| P3.5 | Demo analytics (cookieless events: demo_started, demo_completed, cta_clicked) and funnel attribution stored as aggregate only. | No identifiers in events; dashboard in Plausible shows the funnel. |
| P3.6 | Optional separate worker service for heavy jobs (only if P3.3 needs it): ADR first. | ADR accepted before code. |

**Commit milestones:** `feat(demos): add demo engine, shell and budget guard` · `feat(demos): add instagram lead agent simulation` · `feat(demos): add linkedin outreach simulation with approval gate` · `feat(demos): add document intelligence demo` · `feat(demos): add business management suite demo`

---

## Phase 4 — GDPR compliance, CI/CD & production hardening

Goal: legally compliant, observable, resilient production launch.

| ID | Task | Acceptance criteria |
|---|---|---|
| P4.1 | Consent management: custom banner per Garante guidelines (Accept all / Reject all equal prominence, close "X" = reject, granular preferences, no scroll-consent, re-prompt not before 6 months unless conditions change), consent receipt stored server-side (random id, choices, policy version, timestamp, no IP), `<ConsentGate category>` for every non-essential script/embed, footer link to reopen preferences. | Playwright: no non-essential request before consent; reject persists; withdrawing is as easy as giving. |
| P4.2 | Legal pages IT/EN: Informativa privacy (Art. 13 GDPR), Cookie policy (with tables of every cookie/storage key), Note legali/Imprint, Terms for demos (AI disclosure, no reliance), versioned with dates. | Every processor and storage key in code appears in the policy (checked by a script listing `localStorage`/cookie keys). |
| P4.3 | Data subject rights & retention: documented process (email to privacy address, 30-day SLA), admin script to export/delete a lead by email, scheduled deletion of inquiries older than the retention period (e.g. 24 months, or per your policy), consent receipts kept as proof. | Delete script tested; cron (Vercel Cron) purges expired rows; ROPA updated. |
| P4.4 | Hardening: CSP enforced (no `unsafe-inline` for scripts), HSTS preload submission, `security.txt` (`/.well-known/security.txt`), dependency audit clean, Turnstile + rate-limit thresholds tuned, error pages leak nothing. | Mozilla Observatory ≥ A+; ZAP baseline scan (CI job) with no high findings. |
| P4.5 | Observability: Vercel Analytics off (or confirmed cookieless), error tracking EU region with PII scrubbing, uptime check, budget alerts on Claude API and Vercel spend. | Test error appears in tracker without PII; alerts fire on a test threshold. |
| P4.6 | Performance budget enforced in CI (Lighthouse CI): LCP, CLS, TBT, JS weight per route. | CI fails when budget exceeded. |
| P4.7 | Launch checklist: domain + DNS (CAA, DNSSEC), email auth (SPF, DKIM, DMARC `p=quarantine` or stricter), redirects, `hreflang` verified, Search Console, backups of DB, incident & breach procedure (72 h notification to Garante). | All items checked in `docs/GDPR_CHECKLIST.md` and `docs/LAUNCH.md`. |

**Commit milestones:** `feat(privacy): add consent management and consent receipts` · `docs(legal): add privacy, cookie and legal notices` · `feat(privacy): add retention job and data subject request tooling` · `ci: enforce performance budget and dast baseline` · `chore(release): production launch v1.0.0`

---

## Phase 5 — Post-launch (backlog)

- Blog / insights (MDX) with RSS; newsletter only with double opt-in.
- Live client-sandbox demos behind authentication (magic link) for qualified leads.
- Stripe Checkout for fixed-price packages + SDI e-invoicing integration.
- Third locale (DE or ES) once traffic justifies it.
- Graphify or similar code-graph tooling once the codebase passes ~50k LOC (see audit).
