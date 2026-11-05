# Master Blueprint — AI Solutions & Full-Stack Engineering Website

Owner: Ramin Rashidi Alavijeh (independent AI practice, Turin) · Drafted 2026-11-03 · Status: **decisions D1–D8 confirmed by owner on 2026-11-03**

This folder is laid out as a repository skeleton. Copy its contents into the root of the new repo:

| File | Purpose |
|---|---|
| `BLUEPRINT.md` (this file) | Decisions, assumptions, target architecture. Keep it as `docs/BLUEPRINT.md` in the repo. |
| `CLAUDE.md` | Rules Claude Code follows in every session. |
| `ROADMAP.md` | Phases, tasks, acceptance criteria, commit milestones. |
| `PROJECT_STATE.md` | Live session-handoff file (current task, decisions log, blockers). |
| `docs/SECURITY_TOOLING_AUDIT.md` | Source audit of the skills, MCP servers and plugins you named, with install steps. |
| `docs/GDPR_CHECKLIST.md` | GDPR / Garante / ePrivacy / AI Act implementation checklist. |
| `.claude/settings.json` | Claude Code permissions (deny secrets, deny push, allow verification commands). |
| `.mcp.json` | Project MCP servers (21st.dev, key via env var). |
| `.github/workflows/*.yml`, `.github/dependabot.yml` | CI, security scanning, dependency updates. |
| `.env.example` | Environment variable contract, split by exposure. |

---

## 1. Critical open decisions (answer these first)

Each of these changes the architecture. I picked a default for each so work is not blocked; the default is what the rest of the blueprint assumes.

| # | Decision | Default I assumed | What changes if you pick otherwise |
|---|---|---|---|
| D1 | **Hosting** | **Vercel**, functions pinned to `fra1` (Frankfurt), Pro plan for commercial use. | Cloudflare Workers/Pages (OpenNext adapter): cheaper at scale and EU-native edge, but some Next.js features lag, and ISR/image optimisation need extra config. A self-hosted EU VPS (Hetzner + Coolify/Docker) gives full data residency but you own patching, TLS and uptime. |
| D2 | **Backend for demos** | Next.js Route Handlers + Server Actions in the same repo. Demos run in **simulation mode** by default (scripted, deterministic data); an optional "live AI" mode calls the Claude API server-side with strict per-IP and global budget caps. | A separate service (FastAPI/Python or a Node worker) only becomes worth it if demos need long-running jobs, queues or heavy document processing (D-Intel demo). Plan for it in Phase 3 behind an interface, not now. |
| D3 | **Content / CMS** | **MDX files in the repo** with Zod-validated frontmatter (case studies, services, blog). Zero cost, versioned, reviewable in PRs. | A headless CMS (Sanity, Payload, Storyblok) if a non-developer must edit content. Adds a processor to the GDPR register and a preview pipeline. |
| D4 | **Languages** | **Italian (default) + English**, sub-path routing `/it/...`, `/en/...` via `next-intl`, `hreflang` tags, translated legal pages. | IT-only halves copywriting work but limits EU reach. Adding a third language later is cheap if i18n is in from day one, and expensive if retrofitted. |
| D5 | **Lead storage** | Inquiries saved to **EU-hosted Postgres** (Neon `aws-eu-central-1` or Supabase Frankfurt) via Drizzle ORM, plus an email notification through an EU-region transactional provider (Resend EU or Brevo). | Email-only (no DB) is simpler and keeps less PII, but you lose a funnel/pipeline view. A CRM (HubSpot, Pipedrive) adds a US processor and needs SCCs/DPF review. |
| D6 | **Analytics** | **Cookieless, EU-hosted** (Plausible EU or self-hosted Umami). No consent needed for that alone under Garante guidance when it collects no personal data, but it is still disclosed in the privacy notice. | GA4 / Meta Pixel require prior opt-in consent, a Consent Mode v2 setup, and a heavier banner. Not recommended for this audience. |
| D7 | **"Order" funnel** | Order = **qualified inquiry + discovery-call booking** (Cal.com, EU data region), no online payments in v1. | Stripe Checkout for fixed-price packages (audit, MVP sprint). Adds invoicing (Italian e-invoicing via SDI), VAT rules for B2B EU (reverse charge) and T&Cs. |
| D8 | **Repo visibility** | **Private** repo; public case studies live on the site. | Public repo is a portfolio signal, but then demo prompts, rate-limit thresholds and abuse heuristics are public. If public, move those to env/config. |

**One point that is not a preference but a legal and platform risk (read before Phase 3):**
Meta's and LinkedIn's terms prohibit automated engagement, scraping and bot-driven outreach on personal accounts. LinkedIn in particular forbids third-party automation of the site. Showcasing a "LinkedIn automation agent" that drives real accounts can get you and your clients' accounts banned, and it markets a capability that clients could be liable for. The blueprint therefore:
- runs the Instagram and LinkedIn demos **only as simulations** against synthetic profiles and data;
- positions the real offering as agents built on **official APIs** (Instagram Graph API / Messenger Platform for business accounts, LinkedIn's approved partner APIs where available) and on **human-in-the-loop** drafting (the agent drafts, a person sends);
- keeps that framing in the copy ("assisted outreach", "lead qualification", "inbox triage") rather than "automation that bypasses limits".

---

## 2. Safe assumptions (stated, proceeding with them)

- **Runtime:** Node.js 24 LTS, `pnpm` (lockfile committed, `--frozen-lockfile` in CI), `corepack` enabled.
- **Framework:** Next.js 16 (App Router, React Server Components by default, Turbopack), React 19, TypeScript in `strict` mode. Check the exact current minor at setup with `pnpm dlx create-next-app@latest`; pin what it installs.
- **Styling:** Tailwind CSS v4 (CSS-first `@theme` tokens), `clsx` + `tailwind-merge`, shadcn/ui as the primitive layer (Radix under the hood, accessible by default).
- **Motion:** GSAP 3 + ScrollTrigger (+ SplitText/Flip as needed; all GSAP plugins have been free for commercial use since 2025), `@gsap/react` (`useGSAP`) for cleanup, **Lenis** (`lenis` package) for smooth scroll, synced to GSAP's ticker. `motion` (Framer Motion) only for small component micro-interactions, never mixed with GSAP on the same element.
- **React Bits:** used as a **copy-in source** (components copied into `src/components/fx/`, adapted to tokens, reviewed), not as a runtime dependency. Check its licence text at copy time and keep the attribution in `docs/THIRD_PARTY.md`.
- **Validation & safety:** Zod for every external input (forms, route handlers, env), `server-only` imports for secrets, Upstash Redis (EU region) for rate limiting, Cloudflare Turnstile for bot protection on forms (disclosed in the privacy notice).
- **Testing:** Vitest + Testing Library (unit/component), Playwright (e2e, visual smoke), `@axe-core/playwright` (accessibility), Lighthouse CI (performance budget).
- **Quality:** ESLint 9 flat config (`next/core-web-vitals`, `typescript-eslint` strict, `jsx-a11y`), Prettier with `prettier-plugin-tailwindcss`, `knip` for dead code.
- **Fonts:** self-hosted through `next/font/local` or `next/font/google` (which downloads at build time and serves from your domain, so no request goes to Google at runtime).
- **AI provider for live demos:** Claude API via `@anthropic-ai/sdk`, server-side only. Use the current Sonnet-class model for the demos and Haiku-class for cheap classification. API inputs are not used for model training by default under Anthropic's commercial terms; disclose the processing anyway.
- **Human-in-the-loop git:** Claude Code never commits or pushes. It ends each task with a proposed Conventional Commit message and a summary; you review, commit, push.

---

## 3. Target architecture

```
                 ┌───────────────────────── Vercel (fra1) ──────────────────────────┐
 Browser ──TLS──▶│  Next.js 16 App Router                                            │
 (IT/EN)         │   ├─ app/[locale]/(marketing)   RSC pages, MDX content, SSG/ISR   │
                 │   ├─ app/[locale]/demos/*       client islands (GSAP/Lenis, sims)  │
                 │   ├─ app/api/inquiry            Route Handler: Zod → rate-limit →  │
                 │   │                             Turnstile → DB → email             │
                 │   ├─ app/api/demos/*            sim engine | live AI (budget cap)  │
                 │   └─ middleware.ts              locale, CSP nonce, security hdrs   │
                 └──────┬──────────────┬───────────────┬──────────────┬──────────────┘
                        │              │               │              │
              Postgres (EU)     Upstash Redis (EU)   Email (EU)    Claude API
              leads, consent    rate limits, budget  notifications  live demo mode only
              receipts
```

### Directory layout

```
src/
  app/
    [locale]/
      (marketing)/        page.tsx, services/, work/[slug]/, about/, contact/
      demos/              instagram-agent/, linkedin-agent/, doc-intel/, business-suite/
      (legal)/            privacy/, cookie-policy/, terms/, imprint/ (note legali)
      layout.tsx
    api/
      inquiry/route.ts
      demos/[demo]/route.ts
      consent/route.ts    stores consent receipt (no PII; random id + choices + version)
    sitemap.ts, robots.ts, manifest.ts
  components/
    ui/                   shadcn primitives (generated, then owned)
    fx/                   motion components (React Bits–derived, GSAP-based)
    sections/             page sections (Hero, Services, CaseStudyGrid, CTA…)
    demos/                demo shells, chat UI, dashboards
    consent/              banner, preferences dialog, <ConsentGate>
  lib/
    env.ts                Zod-validated env (server/public split)
    security/             csp.ts, rate-limit.ts, turnstile.ts, sanitize.ts
    db/                   drizzle schema, client (server-only)
    ai/                   claude client, prompts, budget guard (server-only)
    motion/               lenis provider, gsap registration, reduced-motion hook
    i18n/                 next-intl config, routing
    logger.ts             structured logger with PII redaction
  content/                MDX: case-studies/, services/, legal/ (it, en)
  messages/               it.json, en.json
tests/                    e2e/, a11y/, unit colocated as *.test.ts(x)
docs/                     BLUEPRINT.md, SECURITY_TOOLING_AUDIT.md, GDPR_CHECKLIST.md,
                          adr/NNNN-title.md, THIRD_PARTY.md, ROPA.md
```

### Demo architecture (Phase 3)

Every demo implements one interface so it can run as a simulation, a live AI call, or (later) a proxied client sandbox:

```ts
// src/lib/demos/types.ts
export interface DemoEngine<I, O> {
  id: 'instagram-agent' | 'linkedin-agent' | 'doc-intel' | 'business-suite';
  mode: 'simulation' | 'live';
  run(input: I, ctx: { sessionId: string; locale: 'it' | 'en' }): AsyncIterable<O>; // streams steps
}
```

- **Simulation engine:** scripted step timelines with seeded randomness, synthetic personas, no network. Default for every visitor, works with zero API budget.
- **Live engine:** server-side Claude call, strict system prompt, output schema validated with Zod, max tokens capped, per-IP (e.g. 5/hour) and global daily budget in Redis. Falls back to simulation when the budget is exhausted.
- **Demo-specific notes**
  1. *Instagram engagement & lead agent:* simulated inbox + comments feed; the agent classifies intent, drafts replies, scores leads, and hands off to the inquiry funnel ("Want this for your brand?" pre-fills the form with the demo's scenario, not with any personal data).
  2. *LinkedIn outreach agent:* simulated prospect list → research summary → drafted message → human approval step shown explicitly. Copy emphasises compliance and HITL.
  3. *Document intelligence:* upload restricted to bundled sample PDFs in v1 (no visitor uploads, which avoids processing unknown personal data). Visitor uploads only in a later phase, with size/type limits, in-memory processing, no storage, and a clear notice.
  4. *Business management app (POS, cash flow, purchases):* a self-contained client-side app with seeded fake data in IndexedDB, reset button, no server persistence. Showcases dashboards, charts and workflows.

### Security baseline

- **Headers (middleware):** strict nonce-based CSP (`default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`, plus explicit `connect-src` for Plausible/Turnstile), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera/mic/geolocation, `Cross-Origin-Opener-Policy: same-origin`. Start CSP in `Report-Only` for one deploy, then enforce.
- **Inputs:** Zod at every boundary; no `dangerouslySetInnerHTML` except for trusted MDX; if any user HTML is ever rendered, sanitise with DOMPurify (isomorphic). Never interpolate user input into prompts without delimiting and length limits; treat model output as untrusted (render as text, validate JSON with Zod).
- **Rate limiting:** Upstash sliding window per IP hash (IP is hashed with a rotating salt, never stored raw) on `/api/inquiry` and `/api/demos/*`; global AI spend cap.
- **Env segmentation:** `src/lib/env.ts` validates two schemas: `server` (secrets, never imported by client code, guarded with `import 'server-only'`) and `client` (`NEXT_PUBLIC_*`, non-secret only). Separate values per Vercel environment (Development / Preview / Production). Preview deployments use a separate DB branch and a test Turnstile key, and never production secrets.
- **Supply chain:** pnpm lockfile, Dependabot, `dependency-review-action` on PRs, CodeQL, gitleaks, GitHub Actions pinned to commit SHAs, `pnpm` `onlyBuiltDependencies` allow-list so install scripts don't run for arbitrary packages.
- **Logging:** structured logger that redacts emails, phone numbers, names and IPs; no request bodies in logs; error tracking (if added, e.g. Sentry EU region) with `sendDefaultPii: false` and replay disabled.

---

## 4. How to use this with Claude Code

1. Create the GitHub repo (private), clone it, copy this folder's files in, commit them yourself as `chore: add project governance and blueprint`.
2. Start Claude Code in the repo root. It reads `CLAUDE.md` automatically.
3. First prompt of every session: *"Read PROJECT_STATE.md and ROADMAP.md, then continue with the next task."*
4. Give one roadmap task ID per prompt (e.g. `P1.3`). Claude finishes with: changes made, verification results, a proposed commit message, and an updated `PROJECT_STATE.md`.
5. You review the diff, commit, push. Vercel builds a preview per branch/PR; CI must be green before merge.
6. Record every architectural choice as an ADR in `docs/adr/` (Claude drafts it, you approve).
