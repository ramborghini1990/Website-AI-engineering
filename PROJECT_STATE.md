# PROJECT_STATE.md

Live handoff file between Claude Code sessions. Claude updates it at the end of every task; you review it with the diff. Keep it short: history belongs in git and ADRs, not here. Sections marked *(rolling)* keep only the latest ~10 entries.

_Last updated: 2026-11-05 · by: Claude Code · branch: `main` (P1.4 committed as `7fc6b2d`)_

---

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 1 — Core framework, design system & motion (Phase 0 closed 7/7, carry-overs in section 8) |
| Active task | `P1.5` — Motion system (Lenis + GSAP in one loop, single GSAP registration, `useReducedMotion`, CLS < 0.05, zero ScrollTrigger leaks, reduced-motion e2e) |
| Status | **acceptance criteria met, awaiting review (not committed)** |
| Next task | `P1.6` — see ROADMAP; do not start unprompted |

**Plan for the active task**
1. `src/lib/motion/`: `tokens.ts` (mirror of the CSS motion tokens, parity-tested), `gsap.ts` (the only GSAP import point: registers `useGSAP`, `ScrollTrigger`, `CustomEase` once, creates the `ds-*` eases, refreshes after fonts), `use-reduced-motion.ts`, `use-motion.ts` (`useGSAP` + `gsap.matchMedia`, everything reverted on unmount / deps change / preference flip), `reveal.ts` helpers.
2. `LenisProvider` mounted once in `[locale]/layout.tsx`; the engine (`lenis-runtime.tsx`) is a lazy chunk loaded after idle and never under reduced motion; one loop: `gsap.ticker` calls `lenis.raf`, Lenis `scroll` calls `ScrollTrigger.update()`; route change refreshes ScrollTrigger; Radix scroll lock stops/starts Lenis.
3. Layout: body `min-h-dvh`, no height on `<html>` (the upstream `html.lenis { height:auto }` rule caused CLS 0.062 and is not copied).
4. Dev test page `/[locale]/_dev/motion` (intro, 6 reveals, 1 pinned scrubbed scene) and `window.__motionDebug` (dev-tools only).
5. Tests: unit (152 in total) and e2e (`motion.spec.ts` against `next dev`, `scroll.spec.ts` against the production build), with mutation checks; `docs/MOTION.md`.

**Where I stopped** (exact file/function, what's half-done)
- Nothing half-done. Throwaway probes and mutations are removed or reverted; no `next` / `playwright` process or listener on 3100, 3101, 3200 (netstat + command-line check).
- The GSAP licence is custom and has **not** been reviewed by a human: tick the box in `docs/THIRD_PARTY.md` after reading https://gsap.com/standard-license.
- `e2e/gallery.spec.ts` was edited (one wait added, see section 8, "P1.5 / select test"); no assertion was weakened.

---

## 2. Phase progress

| Phase | Status | Tasks done | Notes |
|---|---|---|---|
| 0 Setup & governance | ✔ | 7/7 | Marked complete at your instruction. P0.7 awaiting commit. ROADMAP says a phase is done only when every acceptance criterion is checked **and CI is green on `main`**; not all are evidenced, see "Phase 0 carry-overs" in section 8 |
| 1 Core, design system, motion | ◐ | 4/8 | P1.1–P1.4 committed; P1.5 awaiting review/commit |
| 2 Landing & value proposition | ☐ | 0/7 | |
| 3 Agent showcases & funnels | ☐ | 0/7 | |
| 4 GDPR, CI/CD, hardening | ☐ | 0/7 | |

---

## 3. Completed milestones *(rolling)*

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

---

## 4. Decisions log

Short entries; anything structural also gets an ADR in `docs/adr/`.

| # | Date | Decision | Why | ADR |
|---|---|---|---|---|
| D1 | 2026-11-03 | Hosting: Vercel `fra1` | EU region, previews, Next.js-native | — |
| D2 | 2026-11-03 | Demo backend: Route Handlers, simulation-first | Zero running cost, no ToS risk | — |
| D3 | 2026-11-03 | Content: MDX in repo | Versioned, no extra processor | — |
| D4 | 2026-11-03 | i18n: IT default + EN via next-intl | Market reach, cheap if done early | — |
| D5 | 2026-11-03 | Leads: EU Postgres + EU email | Data residency, funnel view | — |
| D6 | 2026-11-03 | Analytics: cookieless EU (Plausible/Umami) | No consent banner for analytics | — |
| D7 | 2026-11-03 | Order funnel = inquiry + booking, no payments v1 | Avoids invoicing/VAT scope | — |
| D8 | 2026-11-03 | Repo private | Keeps abuse heuristics private | — |
| D9 | 2026-11-04 | Pinned toolchain: Node 24 (`.nvmrc` `24`, engines `24.x` since D15), pnpm 12.16.1 via `packageManager`; Next 16.4.5, React 19.3.0, Tailwind 4.3.4, TS 5.9.3 | Reproducible installs; versions are what `create-next-app` resolved today | — |
| D10 | 2026-11-04 | `@types/node` bumped from scaffold `^20` to `^24` | Types should match the pinned Node runtime | — |
| D11 | 2026-11-04 | Claude permissions: env/secret/key files denied for Read and Edit by explicit filename (not `.env.*`); state-changing git, `rm -rf`, `npm install`, publish and curl/wget-to-shell denied; rules mirrored for `Bash` and `PowerShell` tools | A blanket `.env.*` deny would also block `.env.example`, and deny always wins over allow | — |
| D12 | 2026-11-04 | Tooling: `typescript-eslint` `strictTypeChecked` (TS files only), `eslint-plugin-jsx-a11y` strict rules, Prettier + `prettier-plugin-tailwindcss`, `knip`; `*.md`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` excluded from Prettier. `knip` and `format:check` are separate scripts, not part of `verify` | Matches the P0.3 spec; hand-formatted docs tables and pnpm-managed files would create noisy diffs | — |
| D13 | 2026-11-04 | Testing: Vitest 5 (jsdom, globals off, explicit imports) for `src/**/*.test.{ts,tsx}`; Playwright (Chromium only for now) in top-level `e2e/` against a production build on port 3100; `@axe-core/playwright` scan with WCAG 2.0/2.1/2.2 A+AA tags, zero violations allowed. `pnpm verify` runs unit tests only; e2e stays a separate command (`pnpm test:e2e`) | Matches CLAUDE.md §4 (`verify` = typecheck + lint + test + build); a production build avoids dev-overlay noise in axe results | — |
| D14 | 2026-11-04 | CI: GitHub Actions only; every action pinned to a full commit SHA with a version comment (`checkout` v7.0.1, `setup-node` v7.1.0, `cache` v6.1.0, `upload-artifact` v7.0.2); pnpm via Corepack from `packageManager`; Node from `.nvmrc`. Secret scanning = gitleaks 8.30.1 binary pinned by version + sha256 (no third-party action); CodeQL and dependency-review excluded because the repo is private without GHAS | Supply-chain hygiene; the official gitleaks action needs a paid licence once the repo is owned by an organisation | — |
| D15 | 2026-11-04 | Vercel: `vercel.json` pins `regions: ["fra1"]`, `framework: nextjs`, `installCommand: pnpm install --frozen-lockfile`; `engines.node` is `24.x`; Pro plan required (Hobby is non-commercial only); `ENABLE_EXPERIMENTAL_COREPACK=1` to honour `packageManager`; Preview and Production use separate DB/Redis/keys per the matrix in `docs/DEPLOYMENT.md` §3; Vercel Authentication on for Previews; Web Analytics / Speed Insights off | Region and Node version are then reproducible from the repo; Vercel's default Node is a newer major than the one we pin; commercial site needs Pro; Preview must never touch production data (BLUEPRINT) | — |
| D16 | 2026-11-04 | Tooling: 21st MCP is committed in `.mcp.json` as a project server (remote HTTP, key from `${API_KEY_21ST}`); `enableAllProjectMcpServers` stays off and the server is not pre-approved in `.claude/settings.json`. UI/UX Pro Max is installed by you from your own fork pinned to the reviewed commit `713eef5` (or `ccce51c`, README-only delta); Claude does not install plugins or skills. Other audited tools stay uninstalled | Audit §1–§2, §8; CLAUDE.md §13 | — |
| D17 | 2026-11-05 | **Approved by you 2026-11-05:** design direction "instrument panel" in `docs/DESIGN.md`. Palette Ink / Bone / Signal (amber `#FFB347` dark, `#9C4700` light) / Trace; Instrument Sans + JetBrains Mono; fluid scale 360→1440 px with 16→18 px body; 4 px base unit; radii 2/4/8 px; motion tokens 80–1100 ms with `expo.out`-style `ease-out`; dark baseline, system preference respected | Dark-first technical identity that avoids the template look (CLAUDE.md §7); every required pair computed ≥ 4.5 : 1 (text) or ≥ 3 : 1 (UI) in both themes | — |
| D18 | 2026-11-05 | Token implementation (P1.2): `@theme static` holds the dark baseline and Tailwind's default scales are cleared; light theme via `:root.light` plus an identical `prefers-color-scheme: light` block; shadows as plain variables + `@utility` (not `@theme`); `dark:` variant defined to match the same model, reserved for assets that cannot use tokens; guards in `verify`: `src/app/globals.test.ts` (WCAG 2.2 AA on real tokens, doc/CSS sync) and `src/no-raw-colors.test.ts` | Single source of truth that tests can parse; Tailwind inlines theme shadows at build time, which broke theming; clearing defaults makes "semantic tokens only" structural | — |
| D19 | 2026-11-05 | UI primitives (P1.3): hand-written in the shadcn pattern on individual `@radix-ui/react-*` packages, **no shadcn CLI**; `cn()` = clsx + tailwind-merge extended with our custom token names; Toast = Radix Toast + own tiny store (no Sonner); every string a component needs (close, viewport label) is a **required prop** because copy must come from i18n; sizes never below 44 px (checkbox: 24 px box with an invisible 44 px hit area); component animations are `--animate-*` tokens, all switched to `none` under `prefers-reduced-motion` in `globals.css`; errors persist until dismissed, other toasts close after 8 s | CLAUDE.md §5, §9, §12, §13; WCAG 2.2.1, 2.5.8; the audit flags `npx shadcn add` as unpinned code execution | — |
| D20 | 2026-11-05 | Dev gallery: code in `src/app/[locale]/dev-tools/`, public URL `/[locale]/_dev/ui` via a rewrite in `next.config.ts`; layout calls `notFound()` unless `isDevelopment` (`src/lib/env.ts`, the only `process.env` read, a stand-in until P1.7's Zod env). Playwright has two projects/servers: production build on 3100 (what users get; also asserts the 404s) and `next dev` on 3200 (gallery) | A `_dev` folder is a private folder (never routable); a `%5Fdev` folder makes `next dev` and `next build` emit conflicting route types (`"/[locale]/%5Fdev"` vs `"/[locale]/_dev"`), which broke `pnpm verify` after any dev session. Next 16 writes dev output to `.next/dev`, so both servers can run together | — |
| D21 | 2026-11-05 | i18n (P1.4): next-intl 4.14.9; locales `it` (default) and `en`; prefix always; locale from `next/root-params` (Cache Components); `proxy.ts` (Next 16 name) with matcher `/((?!api\|trpc\|_next\|_vercel\|.*\\..*).*)`; **`localeCookie: false`** and **`alternateLinks: false`** (hreflang only in HTML metadata); typed messages with Italian as the source shape; root layout is `app/[locale]/layout.tsx` and there is no `app/layout.tsx`; canonical and hreflang are absolute via `siteUrl` (`resolveSiteUrl`: explicit var, Vercel production domain, `VERCEL_URL`, localhost); `tsconfig` excludes `.next/dev`; `@parcel/watcher` and `@swc/core` build scripts stay disabled | The URL carries the language so no storage is needed (GDPR); a pass-through root layout would break root params; stale dev types broke `verify` after every route change; the two scripts only serve next-intl features we do not use (CLAUDE.md §5) | — |
| D22 | 2026-11-05 | Motion (P1.5): `gsap`, `@gsap/react`, `lenis` (named in CLAUDE.md §5). `src/lib/motion/gsap.ts` is the only GSAP import point and registers once (no-op on the server). **One loop:** Lenis `autoRaf:false`, `gsap.ticker` drives `lenis.raf`, Lenis `scroll` drives `ScrollTrigger.update()`, `lagSmoothing(0)` while running and restored on cleanup; touch stays native (`syncTouch:false`). Components write animations only through `useMotion` (`useGSAP` + `gsap.matchMedia` with `reduced` / `full`), so all tweens and triggers are reverted on unmount, deps change and live preference flips. Reduced contract: final state or ≤ 0.16 s opacity fade, no pin/scrub/loops. **Lazy engine:** `LenisProvider` loads the chunk after idle (≈ 47 KB transferred, 119 KB raw) and not at all under reduced motion. Radix scroll lock (`body[data-scroll-locked]`) stops Lenis; scrollable overlays carry `data-lenis-prevent`. Motion tokens are mirrored in `tokens.ts` and parity-tested against `globals.css`. Layout: `min-h-dvh` on `<body>`, no height on `<html>`, upstream `html.lenis{height:auto}` not copied (it measured CLS 0.062 with the previous `h-full` layout; with the fix 0.0000). Playwright runs a `globalSetup` that warms the dev routes sequentially | Meets CLAUDE.md §8 literally (single loop, single registration, cleanup via `useGSAP`, reduced motion implemented in the hook and the provider); the lazy chunk keeps motion code off the critical path; mirrored tokens avoid two sources of truth drifting silently; parallel first compiles of new `next dev` routes crashed with `Unexpected end of JSON input` | — |

---

## 5. Blockers & open questions

| # | Blocker / question | Owner | Needed by task |
|---|---|---|---|
| B1 | ~~Confirm decisions D1–D8~~ confirmed 2026-11-03 | you | — |
| B2 | Company legal data for footer (sede legale, P.IVA, REA, capitale sociale, PEC) | you | P1.8 |
| B3 | Privacy contact email + retention period for inquiries | you | P2.5 / P4.3 |
| B4 | Legal review of privacy/cookie policy texts | you / counsel | P4.2 |
| B5 | Vercel: confirm the team is on **Pro** (not Hobby; Hobby is non-commercial only), MFA is on, and the DPA is accepted. Deployment itself is done | you | before launch (P4.7) |
| B7 | Do the P0.7 machine steps (`docs/TOOLING_SETUP.md` §1–§2). Partly visible: `mcp__21st__*` tools are now registered in this session, so the server was approved; not exercised, and `claude mcp list` output / the design-skill fork are unconfirmed | you | P1.3+ (21st), optional second opinion for P1.1 (design skill) |
| B8 | ~~Approve `docs/DESIGN.md` §11~~ approved 2026-11-05 (amber, Instrument Sans + JetBrains Mono, dark-first, sharp radii). **Still open:** does INAMBIENTE already have a logo / brand colours? If yes, reconcile with the tokens before P1.8 (header) | you | P1.8 |
| B6 | Production domain name (needed for `NEXT_PUBLIC_SITE_URL` in Production). **Now also drives canonical and hreflang URLs** (P1.4); until it is set they use Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`) | you | P1.7 / P2.6 / before indexing |

---

## 6. Environment & services status

| Service | Dev | Preview | Prod | Notes |
|---|---|---|---|---|
| Vercel project | n/a | unverified (PR preview not evidenced) | Ready: https://website-ai-engineering.vercel.app/ (from `282dcbb`) | region fra1 set in `vercel.json`; runbook `docs/DEPLOYMENT.md`; no env vars set yet (app reads none) |
| Postgres (EU) | | | | separate branch per env |
| Upstash Redis (EU) | | | | |
| Email provider (EU) | | | | SPF/DKIM/DMARC |
| Turnstile | test key | test key | prod key | |
| Claude API | | | | budget alert set? |
| 21st MCP | `.mcp.json` committed; `API_KEY_21ST` user env var, **not confirmed set**; project-server approval pending | n/a | n/a | key never in repo; see `docs/TOOLING_SETUP.md` |

Env vars added this session (names only, never values; all in `.env.example` with placeholders; `src/lib/env.ts` does not exist yet, P1.7 must mirror this list):
- Public: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Server: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_IP_SALT`, `EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`, `ANTHROPIC_API_KEY`, `DEMOS_LIVE_ENABLED`
- Not in the file on purpose: `API_KEY_21ST` (shell env, P0.7)

Local machine note (not in repo): `corepack enable` failed with EPERM on `D:\Program Files\nodejs`, so pnpm shims were created in `%USERPROFILE%\.corepack-bin` (`corepack enable --install-directory`). Add that folder to your user PATH, or run `corepack pnpm …`.

---

## 7. Known issues & tech debt *(rolling)*

| Issue | Impact | Proposed fix | Task |
|---|---|---|---|
| | | | |

---

## 8. Follow-ups noticed (not done)

- **P1.5 / GSAP licence needs a human check.** The registry licence field is "Standard 'no charge' license" (https://gsap.com/standard-license), not an OSI licence; `@gsap/react` points at the same text. CLAUDE.md and BLUEPRINT say GSAP is free for commercial use; I did not verify that and I am not qualified to. Only public-package plugins are used (`ScrollTrigger`, `CustomEase`). Tick the box in `docs/THIRD_PARTY.md` after reading it.
- **P1.5 / select test (found while verifying, fixed in the test).** `gallery.spec.ts` "select: opens and chooses with the keyboard" started failing most runs after the motion work (ended on "AI agents" instead of "Workflow automation"). Cause, from a step-by-step probe: Radix Select moves the highlight inside a `setTimeout` after `ArrowDown`, so an immediate `Enter` chose the previously highlighted option when the main thread was busy (the engine mounts after idle). In the probe the highlight was still on the first option when Enter was pressed. It is not `data-lenis-prevent` (removed: still failed) or `MotionProbe` (removed: still failed); I did not isolate which P1.5 change made the main thread busy enough to expose it. The test now waits for `data-highlighted` on the target option before `Enter`; 6/6 passes afterwards and the full suite is green. A real user cannot press two keys in the same millisecond, so I treat it as a test race, not a component bug.
- **P1.5 / limits.** CLS was measured on Chromium on a fast machine as the plain sum of shifts without recent input (a negative control proves the tracker sees a real shift); it is not field data and not mid-range mobile. Lenis was not run on iOS Safari or Firefox (touch scrolling is native by design). The ~47 KB engine is fetched on every page after idle, even pages without scroll motion; an opt-out per route is possible later. GSAP `matchMedia` ignores preference changes within 2 ms of each other (tests advance the clock).
- **P1.5 / things I changed outside `src/lib/motion`:** `[locale]/layout.tsx` (LenisProvider; `h-full` removed from `<html>`, body `min-h-dvh`), `globals.css` (Lenis rule subset), `dialog.tsx` / `sheet.tsx` / `select.tsx` (`data-lenis-prevent`), `dev-tools/layout.tsx` + `motion-probe.tsx` + `motion/` (dev page), `ui-gallery.tsx` (link to the motion page), `vitest.setup.ts` (matchMedia / `document.fonts` stubs, `src/test-utils/match-media.ts`), `playwright.config.ts` (`globalSetup`, `e2e/support/servers.ts`; the prod project ignores `gallery|motion` specs, the dev project runs them), `docs/DESIGN.md` §6 (pointer), `docs/THIRD_PARTY.md`. New dirs `src/lib/motion/` and `src/test-utils/` (CLAUDE.md §2: ask before new top-level directories; both are under `src/`).
- **P1.5 / for P1.6+:** write every GSAP animation through `useMotion` (see `docs/MOTION.md`); never import `gsap` directly; animate transform/opacity only; do not put a height on `html`/`body` that depends on the `lenis` class. The motion dev page and `__motionDebug` are 404 / absent in production (asserted in `scroll.spec.ts`).
- **P1.4 decisions for you:** (1) **No locale cookie.** next-intl's default `NEXT_LOCALE` cookie is off: the URL is the preference. Trade-off: someone who picks English on a bookmark-less visit is redirected by browser language again on their next `/` visit. Say if you want the cookie; it would then need a row in the cookie policy (P4.2). (2) **Placeholder copy** in `messages/*.json` is mine: company name, "site under construction", a one-line description derived from CLAUDE.md, and the 404 text. Treat it as a stand-in for P2.1. (3) **Production domain (B6):** until `NEXT_PUBLIC_SITE_URL` is set, canonical and hreflang use Vercel's production domain; set it before the site is indexed.
- **P1.4 / "preserving security headers" is only structural for now.** No security headers exist yet (they are P1.7), so I could not test their survival. `src/proxy.ts` returns next-intl's own response object, so headers and the CSP nonce added there in P1.7 apply to redirects too; keep that shape. Verify with a real header once P1.7 lands (securityheaders.com on a redirect: `/`).
- **P1.4 / I changed existing things to make this work:** `app/layout.tsx`, `app/page.tsx` and the scaffold page test are gone (replaced under `[locale]`); `tsconfig.json` now excludes `.next/dev` (IDE route types now come from `.next/types`, i.e. after `pnpm typecheck` or a build, not from a dev session); `vitest.config.mts` inlines `next-intl`; `playwright.config.ts` gives the production test server `NEXT_PUBLIC_SITE_URL`, and probes the gallery URL for dev readiness; `pnpm-workspace.yaml` records `allowBuilds: false` for `@parcel/watcher` and `@swc/core` (pnpm 12 fails the install otherwise); `docs/DEPLOYMENT.md` and `.env.example` text about the site URL updated; `src/components/ui/button.test.tsx` uses an external href because a catch-all route makes every internal-looking `<a href>` trip `@next/next/no-html-link-for-pages`.
- **P1.4 / known limits:** the switcher keeps the path, not the query string or hash; `next/root-params` does not work in Route Handlers or Server Actions yet (pass the locale explicitly, see `docs/I18N.md`); `global-not-found.tsx` is experimental and not enabled, so requests that the proxy skips and that match no file (e.g. `/x.png`) get Next's plain built-in 404, not a localized one; the 404 title lives in the catch-all route because nested `not-found.tsx` cannot set it; `public/*.svg` from the scaffold are now unused (remove with the home page in P2.2); Italian is the source of the message types, so a string that exists only in English is not caught by types, only by the parity test.
- **P1.4 / for P1.8 and P2.x:** mount `Toaster` and `TooltipProvider` and add the header with the switcher and skip link in `[locale]/layout.tsx` (the switcher takes a `className`; `-ml-3` is used at left-aligned call sites to cancel its padding). Pass any new client-component namespace through the provider in the layout. Add `title: { absolute }` only for same-segment pages (home, 404); child segments get the template.
- **P1.4 / dependency facts:** `next-intl` MIT (registry, 2026-11-05), peers cover Next 16 and React 19; it pulls 24 packages, two with install scripts that stay disabled. Download counts not checked.
- **P1.3 / deviations from the roadmap wording:** the gallery is served at `/_dev` by a rewrite from `dev-tools` (see D20), and `src/lib/env.ts` now exists as a stand-in that reads `NODE_ENV`, which CLAUDE.md §6 would otherwise reserve for the Zod module (P1.7 must absorb it and keep the `isDevelopment` export). The roadmap says "shadcn/ui init"; nothing was initialised or generated by the CLI, there is no `components.json`, so `shadcn add` later would need one and a diff review (record it in `docs/THIRD_PARTY.md`).
- **P1.3 / new dependencies** (named by you or by CLAUDE.md's stack): `@radix-ui/react-{dialog,select,checkbox,tabs,tooltip,toast,label,slot}` (MIT), `lucide-react` (ISC; pnpm resolved 1.68.0 because 1.69.0 was published the same day and the release-age policy held it back), `class-variance-authority` (Apache-2.0), `clsx`, `tailwind-merge` (MIT). Licences from the registry on 2026-11-05; download counts not checked.
- **P1.3 / axe exception, deliberate and narrow:** while a Select listbox is open Radix sets `aria-hidden` on the page and keeps focus inside the listbox; axe only treats `role="dialog"` as modal and reports `aria-hidden-focus`. The open-Select scan disables that one rule, and the test asserts the premise (Tab cannot leave the listbox). Dialog and Sheet are scanned with all rules.
- **P1.3 / dev indicator oddity, unexplained:** in two 360 px screenshots (dialog and sheet open) Next's dev indicator showed "1 Issue". I could not reproduce it in two instrumented runs (no console errors or warnings, clean dev-server log, no issue button in the overlay). Dev-only; revisit if it reappears, ideally with the overlay's issue panel open.
- **P1.3 / things for the real pages:** mount `Toaster` and `TooltipProvider` once in the root layout (P1.8) with translated labels; the primitives carry no copy and no i18n; icon-only controls need an `aria-label` (see the gallery's copy button); tooltips must never be the only source of information. The gallery's English copy is dev-only and exempt from CLAUDE.md §12.
- **P1.3 / local and CI notes:** `pnpm test:e2e` now starts two servers (a full `next build` plus `next dev`); CI needs nothing extra but the run is longer, and `reuseExistingServer` is on locally, so a stale server on 3100 or 3200 will be reused (see the Windows process note below). After `pnpm dev`, `pnpm verify` is safe again because the route types no longer conflict.
- **P1.2 / Windows process hygiene (my mistake, fixed in my workflow).** `Get-NetTCPConnection -State Listen` does not see Node's listeners on this machine, so my "stop the server" checks falsely reported 0. A stale `next start` kept serving an old build's HTML after a rebuild (unstyled page, CSS 500). If a local server seems to serve old output, check `netstat -ano | findstr :PORT` and kill by command line. No `next` processes are running now (verified).
- **P1.2 / theme model to remember.** Dark is the `@theme` baseline; light is `:root.light` plus a duplicate under `@media (prefers-color-scheme: light) { :root:not(.dark) }`. The test enforces that the two light blocks are identical. Tailwind inlines theme shadow values at build time, so shadows are plain variables plus `@utility` rules (otherwise the light override is ignored). Tailwind's default palette, radii, shadows, text sizes, fonts and easings are cleared: using `bg-zinc-50` or `text-white` silently produces nothing, which `src/no-raw-colors.test.ts` now rejects.
- **P1.2 / token names differ slightly from `docs/DESIGN.md` §10 as first written** (`--spacing-section`, `--spacing-gutter`, `--container-page`, forced by Tailwind namespaces; shadows via `@utility`). §10 was updated to describe what was built.
- **P1.2 / not guarded:** arbitrary pixel values in components (CLAUDE.md §7 allows them only with a comment); the no-raw-colour scan treats a 3-letter hex-looking anchor such as `#add` as a colour (none exist today). Reduced motion for component animations is now handled at token level (P1.3); P1.5 still owns Lenis, scroll-linked and FX motion.
- **P1.2 / not verified visually:** hover and focus states (only static renders in both themes at 360 and 1280 px were inspected); 200 % zoom; `wdth` condensed display look was confirmed in the screenshots but not compared against alternatives. Theme toggle, pre-paint theme script and the storage key come with P1.7/P1.8.
- **P1.2 / scaffold page** still carries scaffold copy, `lang="en"` and the "Create Next App" title (P1.4, P2.1/P2.2); it only had its colours, radii and button sizing moved to tokens (buttons now `whitespace-nowrap`, `md:min-w-40`, because Instrument Sans made "Deploy Now" wrap at the old fixed width).
- **P1.1 / thin margins:** light theme `text-muted` and `accent` on `surface-3` are 4.81 and 4.80 : 1; any tweak to those colours needs recomputation. `border-subtle` (1.31–1.46 : 1) is decorative only by design.
- **P1.1 / still open for later tasks:** 200 % zoom of fluid type belongs in Playwright once real pages exist; the theme pre-paint script needs a CSP nonce (P1.7) or a server-resolved cookie; the theme choice is a storage key that must appear in the cookie/storage table (P4.2).
- **`docs/DESIGN.md` is outside Prettier** (`*.md` ignored, D12). Its hex table is now machine-checked against the CSS by `globals.test.ts`; the contrast tables (§2.2–§2.3) are not, but the same pairs are asserted by the test.
- **Phase 0 carry-overs (phase closed at your instruction; these acceptance items are not evidenced).**
  - P0.5: CI green on `main` and "a PR shows all checks" not seen by me; branch protection on `main` not enabled; the fake-secret PR test not run (steps in the CI bullets below).
  - P0.6: "a PR gets a preview URL" not evidenced; build-log Node and pnpm versions not reported (pnpm 12 risk below); `fra1` function region unobservable on a static site. What I did see on 2026-11-04: `https://website-ai-engineering.vercel.app/` answers HTTP 200 from `Server: Vercel` with HSTS, serves the scaffold page (title "Create Next App", one `h1`), and `x-vercel-id` starts with `fra1::`, which names the edge location serving my request and is **not** proof of the function region.
  - P0.7: key, project-server approval, `claude mcp list` showing `21st` connected, and `/plugin` showing only `ui-ux-pro-max` are yours to confirm (B7).
- **P0.7: design-skill upstream drift.** Audit reviewed `713eef5`; upstream `main` is `ccce51c`. `713eef5` is an ancestor with 2 commits since, touching only `README*.md` (file names checked, text not read). The audit's "v2.15.0" label does not match the tag (`v2.15.0` → `a38d04c`): pin by commit.
- **P0.7: `python3` is not usable on this Windows machine** (Microsoft Store shim); use `python` (3.12.0). The audit's commands say `python3`.
- **P0.7: proposal, needs your approval (CLAUDE.md §13):** add deny rules in `.claude/settings.json` for the design skill's risky scripts (`design` skill generators and `ui-styling/scripts/shadcn_add.py`), so the "not without asking" rule is enforced and not only written. Not done.
- **P0.7: 21st.dev is a remote service that receives prompts and tool context.** It should never see visitor personal data (dev tool only), so I did not add it to the GDPR processors list or ROPA. Say if you want it listed anyway. Project MCP servers also load without a prompt in non-interactive runs (`claude -p`, SDK, cloud); none are used here.
- **P0.6: pnpm 12 on Vercel is unverified (main risk).** The lockfile says `lockfileVersion: '9.0'`; Vercel picks pnpm from that unless Corepack is on, and its Corepack support is documented as experimental. Check the first build log for pnpm 12.16.1 and Node 24; fallbacks are in `docs/DEPLOYMENT.md` §6. Moving the repo to another pnpm major is a decision for you, not something to do silently.
- **P0.6: `fra1` cannot be observed yet.** Both routes are static (CDN), so no function runs. Verify on the first dynamic route (inquiry handler, P2.5). `fra1` covers function execution only; CDN/edge is global, so the privacy notice must not claim EU-only hosting.
- **P0.6: Vercel as processor.** `docs/GDPR_CHECKLIST.md` processor line (tagged `[P0.6, P4.2]`) is **not ticked**: DPA acceptance, transfer mechanism (DPF/SCC, unverified here), sub-processors and log retention are yours to confirm; record in `docs/ROPA.md` (does not exist yet, P4.3).
- **P0.6: for P1.7.** `env.ts` must not make `NEXT_PUBLIC_SITE_URL` mandatory in Preview (derive it from Vercel's deployment URL), or every PR preview fails the missing-env build check. `engines.node` change (`>=24 <25` → `24.x`) is equivalent for Node 24 and avoids Vercel's default of a newer major.
- **P0.6: Hobby plan.** It builds fine but breaches Vercel's terms for a company site; use Pro.
- **Limits of the deny rules:** `Read`/`Edit`/`Grep` denies are path-based and solid. The `Bash`/`PowerShell` env patterns (`* .env.local` etc.) only match literal command text; I did **not** test bypass spellings such as `cat ./.env.local` or `type .\.env.local`, which probably slip through. For a hard guarantee, use Claude Code's sandbox / OS-level filesystem restrictions.
- **`.env.example` assumptions to confirm:** email variables are provider-neutral (`EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`) because the EU provider is not chosen yet (P2.5); Turnstile values are Cloudflare's published always-pass test keys, copied from memory, so check them against Cloudflare's docs; no analytics or Cal.com variables yet (D6 platform and P2.7 undecided).
- **CLAUDE.md §13:** changing `.claude/settings.json` normally needs asking; done here because P0.2 explicitly requests it.
- **CI has never run on GitHub.** Everything in `.github/` was checked locally only (see section 9). Likeliest first-run surprises: Corepack on the runner resolving `pnpm@12.16.1`, `setup-node` `cache: pnpm`, and Dependabot's support for the pnpm 12 lockfile format. Read the first PR's checks before relying on them.
- **`actionlint` was not run:** I downloaded it (checksum matched) but the auto-mode classifier blocked executing the binary, so I did not retry. YAML syntax is verified by Prettier and SHA pins against upstream tags; workflow semantics (expressions, step keys) are unchecked. Run `actionlint` yourself or watch the first run.
- **Branch protection is NOT enabled (roadmap P0.5 asks for it).** It is an outward-facing GitHub setting, not requested in this task, and private repos need a plan that supports it. Suggested: require PR, require checks `verify`, `e2e` and `gitleaks`, block force-push. The `gitleaks` check only *fails a PR*; without branch protection nothing stops a direct push of a secret to `main`.
- **Secret test coverage:** detection was proven with `gitleaks dir` on a synthetic canary (rule `github-pat`, exit 1) and `gitleaks git` on the real history (exit 0, 5 commits then). The end-to-end roadmap test, "a commit with a fake secret fails the PR check", could not be run here (`git commit` is denied by `.claude/settings.json`, and pushing is yours). To do it: on a throwaway branch commit a file with a fake `ghp_` + 36 random alphanumerics, open a PR, expect `gitleaks` red, then delete the branch.
- **Detection, not prevention:** by the time CI flags a secret it is already in a pushed commit and must be rotated. Consider a local `gitleaks` pre-commit hook later (needs your approval under CLAUDE.md §13; hooks are not approved by default).
- **gitleaks upgrades are manual:** `GITLEAKS_VERSION` and `GITLEAKS_SHA256` in `security.yml` are not tracked by Dependabot. Bump both together from the release's checksums file.
- **Not added (out of the requested scope):** `pnpm audit` job (roadmap P4.4 wants a clean dependency audit), Lighthouse CI (P4.6), ZAP (P4.4).
- **Playwright in CI:** `playwright.config.ts` switches to retries and github/html reporters when `CI` is set; browsers are cached by lockfile hash and installed with `--with-deps`.
- **New top-level dir `e2e/`:** CLAUDE.md §2 says not to create top-level directories without asking; the task requires a place for Playwright specs, so `e2e/` was chosen. Say if you prefer another location (`tests/e2e`, `src/...`).
- **Test dependencies beyond those you named:** `@vitejs/plugin-react` (JSX transform in Vitest), `@testing-library/dom` (peer of `@testing-library/react` 16) and `@testing-library/jest-dom` (matchers such as `toBeInTheDocument`). `@testing-library/user-event` was **not** added; add it when the first interaction test needs it.
- **Only Chromium:** `playwright.config.ts` has one project. Add Firefox/WebKit and mobile viewports (360/768/1280/1920 per CLAUDE.md §7) when real pages exist; browsers are an extra download each.
- **axe is not a full a11y audit:** it catches roughly a third of WCAG issues automatically. Keyboard flow, focus order and reduced-motion still need explicit specs (P1.5, P1.8).
- **Playwright `webServer` runs `pnpm build && pnpm start`:** a full build per `test:e2e` run when no server is already on port 3100 (about 15 s now, will grow). `reuseExistingServer` is on locally, so a long-lived `pnpm start --port 3100` speeds up iteration.
- **Windows local PATH:** `pnpm` is only on PATH via `%USERPROFILE%\.corepack-bin` (see section 6); Playwright's `webServer` command calls `pnpm`, so it needs that PATH entry in the shell that starts the tests.
- **`eslint-plugin-jsx-a11y` maintenance:** latest release is 2024-10-26 (6.10.2). Works with ESLint 9 and is what `eslint-config-next` uses, but it is the weakest maintenance signal among the new devDependencies. Playwright + axe (P0.4) is the real a11y gate.
- **jsx-a11y wiring:** `eslint-config-next` registers its own plugin instance, so re-registering it throws "Cannot redefine plugin". The config applies only the strict preset's `rules`. If `eslint-config-next` changes how it loads the plugin, revisit.
- **No `no-console` rule yet:** the roadmap Definition of Done says no `console.log` in `src/`. Not part of the P0.3 spec so not added; consider it together with the logger in P1.7.
- **knip scope:** still green with zero config after P0.4; its Vitest and Playwright plugins pick up the new entry files. Add a `knip.json` only if it starts reporting false positives.
- **Prettier line endings:** this Windows checkout has `core.autocrlf` behaviour (git warns LF→CRLF); no `.gitattributes` / `.editorconfig` exists. Consider adding one so files do not flip line endings between machines.
- **Decision for you — `next.config.ts`:** the generator enabled `cacheComponents: true` and `partialPrefetching: true` (kept as generated). Cache Components changes how dynamic data/Suspense work and may interact with the P1.4 (next-intl) and P1.7 (CSP nonce) tasks. Keep or turn off before Phase 1.
- **Decision for you — `AGENTS.md`:** generated by `create-next-app`/`next dev` (re-created if deleted); it points to docs in `node_modules/next/dist/docs/`. CLAUDE.md remains the authority. Keep, or add to `.gitignore`.
- **CLAUDE.md §5 wording:** it refers to `pnpm.onlyBuiltDependencies`; pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (currently `sharp: false`, `unrs-resolver: false`). Note `sharp: false` means `next/image` uses no native sharp build; revisit when image optimisation matters.
- **Scaffold leftovers to replace later:** default `README.md`, default page, `Create Next App` metadata and `lang="en"` (P1.4/P2), raw hex in `globals.css` and `next/font/google` Geist (P1.2).
- **Deprecation notice:** pnpm still warns `eslint@9.39.5` is deprecated (10.x available). Stayed on 9 because the blueprint specifies "ESLint 9 flat config" and `eslint-config-next` 16.4.5 is built against it; revisit when Next supports 10.

---

## 9. Last verification run

```
pnpm install --frozen-lockfile → pass (lockfile up to date)
pnpm verify       → pass, exit 0 (typecheck → lint --max-warnings=0 → test → build); test step: 21 files,
                    152 tests; the build lists the motion and ui dev routes
pnpm test:e2e     → pass, 90 tests (Chromium) in 59 s: production build + `next dev` projects
pnpm knip         → pass
pnpm format:check → pass (does not cover *.md)
no `next` / `playwright` process and no listener on 3100, 3101, 3200 afterwards (netstat + command lines)

P1.5 checks:
  single loop        → unit: only the live Lenis instance receives ticker frames, none after unmount, also under
                       StrictMode; lagSmoothing restored on cleanup
  registration       → plugins registered once (idempotent), no-op on the server (gsap.ssr test), eases created
                       from the CSS bezier tokens; tokens.test.ts fails if tokens.ts and globals.css drift
  reduced motion     → unit (hook, useMotion, provider: engine chunk not rendered) and e2e with
                       `reducedMotion: "reduce"`: no `lenis` class, engine chunk never requested (prod build),
                       no pin spacers, no scrubbed triggers, content visible; live preference flips x3 give
                       stable trigger counts
  leaks              → e2e on the motion page: exactly 7 ScrollTriggers and 1 pin-spacer, 0 after navigating
                       away, exactly 7 / 1 again on return, x3 round trips, Back/Forward, scroll back at top;
                       counts proven by mutation
  CLS                → measured 0.0000 on /it, /en, /it/non-esiste (prod) and on the motion page full and
                       reduced (dev), each over load + Lenis start-up + a full scroll; negative control (an
                       injected shift is detected); mutation: the old `h-full` layout + upstream
                       `html.lenis{height:auto}` gave CLS 0.0617 and the test failed; layout fix kept
  lazy engine        → not in the initial script list, arrives after idle (prod); ≈ 46.9 KB transferred /
                       118.9 KB raw
  scroll lock        → a dialog stops the page behind it (Lenis stopped) and scrolling resumes on close
  bugs found by the tests (all fixed) → CLS 0.0617 from the Lenis height rule (layout change above); dev-server
                       first-compile crash under parallel workers (globalSetup warm-up); a "leak" test that
                       scrolled to top before navigating (rewritten); matchMedia dedupe within 2 ms in unit
                       tests (clock advanced); gallery select test race (section 8)
  NOT done           → Firefox/WebKit/iOS; mid-range mobile CLS/LCP; INP; screen-reader pass; human review of the
                       GSAP licence; the live Vercel deployment after you push
```

---

## 10. Proposed commit(s) for the work above

```
feat(motion): add lenis and gsap motion system with reduced-motion support

Run smooth scrolling and GSAP in a single loop: gsap.ticker drives
Lenis, and Lenis scroll events drive ScrollTrigger. GSAP and its
plugins are registered once in lib/motion/gsap.ts, which is also the
only place components import GSAP from. useMotion wraps useGSAP and
gsap.matchMedia so every tween and ScrollTrigger is reverted on
unmount, dependency change and when the reduced-motion preference
flips. ScrollTrigger is refreshed on route change and after fonts load.

useReducedMotion follows the OS setting live. Under reduce, Lenis is
never loaded and timelines become final states or fades of at most
0.16 s; no pinning, scrubbing or loops. The engine is a lazy chunk
loaded after idle. Radix scroll locks pause Lenis, and scrollable
overlays opt out of smooth scrolling.

Layout shift: body uses min-h-dvh and html has no height, because the
upstream html.lenis height:auto rule produced CLS 0.062 with the old
h-full layout. Measured CLS is 0 on the pages and the motion test page.

Add a dev-only motion page, unit tests, and Playwright specs for CLS,
ScrollTrigger and pin counts across navigations, live preference
changes and scroll lock. Wait for the Radix highlight in the select
keyboard test (Radix moves it in a setTimeout). Document it in
docs/MOTION.md and record the GSAP licence for review.

Task: P1.5

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Session handoff prompt (copy into a new Claude Code session)

> Read `CLAUDE.md`, `PROJECT_STATE.md` and the current phase in `ROADMAP.md`. Summarise the current state in 3 lines, confirm the active task, then continue. Stop when the task's acceptance criteria are met, run `pnpm verify`, update `PROJECT_STATE.md`, and propose a commit message. Do not commit.
