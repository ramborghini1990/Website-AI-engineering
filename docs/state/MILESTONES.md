# Completed milestones

Moved out of PROJECT_STATE.md (which keeps only the last 3).

| Date | Task | Summary | Commit (filled by you) |
|---|---|---|---|
| 2026-11-04 | P0.1 | Next.js 16.4.5 scaffold, strict TS, Tailwind v4, pnpm 12.16.1, Node 24 pinned | `9718ab3` |
| 2026-11-04 | P0.2 | Claude Code permissions, `.env.example` contract, `.gitignore` for env/secrets | `f0c3c40` |
| 2026-11-04 | P0.3 | ESLint strict type-checked + jsx-a11y, Prettier + Tailwind plugin, knip, `verify` script | `9b3b01a` |
| 2026-11-04 | P0.4 | Vitest + Testing Library + jsdom; Playwright + axe smoke test | `c617808` |
| 2026-11-04 | P0.5 | CI workflows (SHA-pinned), gitleaks security workflow, Dependabot | `9d7338c` |
| 2026-11-04 | P0.6 | Vercel `fra1` config, `engines.node` 24.x, deployment runbook; production deployment Ready at https://website-ai-engineering.vercel.app/ (reported by you) | `282dcbb` |
| 2026-11-04 | P0.7 | 21st MCP in `.mcp.json` (key by reference), `docs/TOOLING_SETUP.md`, Phase 0 closed | `18fb0dd` |
| 2026-11-05 | P1.1 | `docs/DESIGN.md`: approved design direction, tokens and contrast tables | `0a62012` |
| 2026-11-05 | P1.2 | Design tokens in `globals.css`, self-hosted Instrument Sans + JetBrains Mono, contrast and raw-colour guards | `9263b31` |
| 2026-11-05 | P1.3 | Accessible UI primitives on Radix, dev-only gallery, keyboard/axe/reduced-motion e2e | `15ba83f` |
| 2026-11-05 | P1.4 | next-intl routing (it/en), proxy, typed messages, switcher, hreflang | `7fc6b2d` |
| 2026-11-05 | P1.5 | Lenis + GSAP in one loop, `useMotion` / `useReducedMotion`, lazy engine, CLS 0, no ScrollTrigger leaks | `f41ee66` |
| 2026-11-05 | P1.6 | FX library: text reveal, magnetic button, marquee, spotlight card, gradient mesh, pinned section; static fallbacks, lazy chunks | `e398ebd` |
| 2026-11-05 | P1.7 | Zod-validated env (server-only guard), nonce CSP (Report-Only default) and security headers in `proxy.ts`, per-request rendering | `259e34a` |
| 2026-11-05 | P1.8 | Layout shell (skip link, header, footer, theme switch, providers), corrected business identity | `6f03a86` |
| 2026-11-05 | P2.1 | Copy deck (IT/EN), content models and collections in `content/`, content test gate | `e70988c`, fix `823681e` |
| 2026-11-06 | P2.2 | Home landing page: hero, proof, services, process, closing CTA; CSS-only `TextReveal when="load"`; `font-display: optional` | `cdc9e49` |
| 2026-11-06 | P2.3 | Services index and detail pages, in-repo Markdown renderer (no MDX library), JSON-LD, no dead links, tracing warning fixed | `68b122d` |
| 2026-11-06 | P2.4 | Work index with filters and detail pages, draft and client-consent guards, `work` in the navigation | `4f78467` |
| 2026-11-06 | P2.5 | Inquiry funnel: four-step form, Server Action, honeypot + Turnstile, rate limit, Postgres via Drizzle, email notification, `/contact/thanks`, allow-list logger | `dc601df` |
| 2026-11-06 | P2.6 | Sitemap, robots, generated share images (`next/og`), one metadata helper for canonical/hreflang/Open Graph/Twitter | `f05a2dd` |
| 2026-11-08 | P2.7 | Click-to-load Cal.com calendar behind `<ConsentGate>`, third-party registry, booking origin in `frame-src` only | `c91d9da` |
| 2026-11-11 | P3.1 | Instagram engagement and lead agent simulation at `/work/instagram-lead-agent`: rule-based classification, lead score, sourced drafts, approval step, CTA with the service pre-selected | `9b70e3f` |
| 2026-11-11 | P3.2 | LinkedIn outreach simulation at `/work/linkedin-assisted-outreach`: rule-based fit rating, drafts, per-prospect approval gate enforced by the reducer, compliance rules as structure tests | `8677097` |
| 2026-11-11 | P3.3 | Document intelligence simulation at `/work/document-intelligence-demo`: three bundled sample documents, fields with evidence, doubtful values flagged for a person, answers citing page and section; no upload surface | `93c06f4` |
| 2026-11-11 | P3.4 | Back-office suite simulation at `/work/business-management-app`: till, cash-flow charts and purchase orders on an invented shop, one IndexedDB database in the visitor's browser (D36) | `41dbff1` |
| 2026-11-11 | P3.5 | Cookieless first-party demo analytics: aggregate daily counters, no script, funnel read with SQL (D37) | `4299fcd` |
| 2026-11-12 | P4.1 | Cookie banner to the Garante guidelines (equal Accept/Reject, X rejects, granular, no scroll consent, 6-month re-prompt), `consent` cookie, insert-only consent receipts with no IP (D38), `ConsentGate` opens on a stored yes, footer "Cookie preferences" | `ed9d9f6` |
| 2026-11-12 | P4.2 | Privacy notice, cookie policy, legal notice and demo terms in IT/EN (draft, versioned); tables printed from the consent registry (storage keys, third parties, processors); footer and banner links; structure tests tie code to registry to text (D39) | `1d687f2` |
| 2026-11-12 | P4.3 | Data subject tooling: `pnpm dsr:export` / `dsr:delete` by email (inquiries only, receipts kept), daily Vercel Cron purge at 730 days with `CRON_SECRET`, `docs/DSR.md` (30-day SLA) and `docs/ROPA.md` (D40) | `59aad4a` |
| 2026-11-12 | P4.4 | Hardening: CSP enforced by default in production (`off` ignored), `/.well-known/security.txt` (RFC 9116, rolling `Expires`), `global-error.tsx`, broken percent-escape → 400, `X-Powered-By` off, error-leak e2e tests, production `pnpm audit` CI job (D41) | `e250eb5` |
| 2026-11-12 | P4.5 | Observability: `GET /api/health` (uncached, status only), PII-scrubbed `onRequestError` reporter with optional EU-only Sentry sink (`SENTRY_DSN`, no SDK), logger redaction for JWTs, keys, key=value pairs and long opaque runs, test guards that Vercel Analytics, Speed Insights and any telemetry SDK stay out, spend-alert runbook for Vercel and Anthropic (D42) | `0de0289` |
| 2026-11-13 | P4.6 (CI/CD) | CI audit and hardening: runners pinned to `ubuntu-24.04`, run cancelling limited to PRs, guard test for pins/permissions/timeouts/required checks, branch protection and required-checks runbook in `DEPLOYMENT.md` §4b (D43). Ruleset not applied; Lighthouse-CI budget (roadmap P4.6) still open | |

---
