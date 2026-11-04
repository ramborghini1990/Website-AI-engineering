# PROJECT_STATE.md

Live handoff file between Claude Code sessions. Claude updates it at the end of every task; you review it with the diff. Keep it short: history belongs in git and ADRs, not here. Sections marked *(rolling)* keep only the latest ~10 entries.

_Last updated: 2026-11-04 · by: Claude Code · branch: `main` (P0.3 committed as `9b3b01a`)_

---

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 0 — Setup, governance & tooling |
| Active task | `P0.4` — Testing harness: Vitest + Testing Library + jsdom; Playwright + axe |
| Status | **awaiting review** (acceptance criteria met, not committed) |
| Next task | `P0.5` |

**Plan for the active task**
1. Add devDependencies: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`; install Chromium for Playwright.
2. `vitest.config.mts` (jsdom, `@/` alias, `src/**/*.test.{ts,tsx}`), `vitest.setup.ts` (jest-dom matchers, explicit cleanup).
3. `playwright.config.ts` (Chromium, `e2e/`, serves a production build on port 3100), `e2e/smoke.spec.ts` (page loads + single h1; axe WCAG 2.2 AA scan with zero violations allowed).
4. Replace the placeholder `test` / `test:e2e` scripts; add `test:watch`; ignore Playwright output in `.gitignore`.
5. Prove the axe check can fail, then remove the throwaway spec.

**Where I stopped** (exact file/function, what's half-done)
- Nothing half-done. Throwaway negative spec removed; tree is green.
- The only unit test (`src/app/page.test.tsx`) and the e2e smoke test exercise the **stock scaffold page**; both are expected to be rewritten when the real home page lands (P2.2).

---

## 2. Phase progress

| Phase | Status | Tasks done | Notes |
|---|---|---|---|
| 0 Setup & governance | ◐ | 4/7 | P0.1–P0.3 committed; P0.4 awaiting review/commit |
| 1 Core, design system, motion | ☐ | 0/8 | |
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
| D9 | 2026-11-04 | Pinned toolchain: Node 24 (`.nvmrc` `24`, engines `>=24 <25`), pnpm 12.16.1 via `packageManager`; Next 16.4.5, React 19.3.0, Tailwind 4.3.4, TS 5.9.3 | Reproducible installs; versions are what `create-next-app` resolved today | — |
| D10 | 2026-11-04 | `@types/node` bumped from scaffold `^20` to `^24` | Types should match the pinned Node runtime | — |
| D11 | 2026-11-04 | Claude permissions: env/secret/key files denied for Read and Edit by explicit filename (not `.env.*`); state-changing git, `rm -rf`, `npm install`, publish and curl/wget-to-shell denied; rules mirrored for `Bash` and `PowerShell` tools | A blanket `.env.*` deny would also block `.env.example`, and deny always wins over allow | — |
| D12 | 2026-11-04 | Tooling: `typescript-eslint` `strictTypeChecked` (TS files only), `eslint-plugin-jsx-a11y` strict rules, Prettier + `prettier-plugin-tailwindcss`, `knip`; `*.md`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` excluded from Prettier. `knip` and `format:check` are separate scripts, not part of `verify` | Matches the P0.3 spec; hand-formatted docs tables and pnpm-managed files would create noisy diffs | — |
| D13 | 2026-11-04 | Testing: Vitest 5 (jsdom, globals off, explicit imports) for `src/**/*.test.{ts,tsx}`; Playwright (Chromium only for now) in top-level `e2e/` against a production build on port 3100; `@axe-core/playwright` scan with WCAG 2.0/2.1/2.2 A+AA tags, zero violations allowed. `pnpm verify` runs unit tests only; e2e stays a separate command (`pnpm test:e2e`) | Matches CLAUDE.md §4 (`verify` = typecheck + lint + test + build); a production build avoids dev-overlay noise in axe results | — |

---

## 5. Blockers & open questions

| # | Blocker / question | Owner | Needed by task |
|---|---|---|---|
| B1 | ~~Confirm decisions D1–D8~~ confirmed 2026-11-03 | you | — |
| B2 | Company legal data for footer (sede legale, P.IVA, REA, capitale sociale, PEC) | you | P1.8 |
| B3 | Privacy contact email + retention period for inquiries | you | P2.5 / P4.3 |
| B4 | Legal review of privacy/cookie policy texts | you / counsel | P4.2 |

---

## 6. Environment & services status

| Service | Dev | Preview | Prod | Notes |
|---|---|---|---|---|
| Vercel project | | | | region fra1 |
| Postgres (EU) | | | | separate branch per env |
| Upstash Redis (EU) | | | | |
| Email provider (EU) | | | | SPF/DKIM/DMARC |
| Turnstile | test key | test key | prod key | |
| Claude API | | | | budget alert set? |
| 21st MCP | key in shell env | n/a | n/a | never in repo |

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

- **Limits of the deny rules:** `Read`/`Edit`/`Grep` denies are path-based and solid. The `Bash`/`PowerShell` env patterns (`* .env.local` etc.) only match literal command text; I did **not** test bypass spellings such as `cat ./.env.local` or `type .\.env.local`, which probably slip through. For a hard guarantee, use Claude Code's sandbox / OS-level filesystem restrictions.
- **`.env.example` assumptions to confirm:** email variables are provider-neutral (`EMAIL_API_KEY`, `EMAIL_FROM`, `INQUIRY_NOTIFY_TO`) because the EU provider is not chosen yet (P2.5); Turnstile values are Cloudflare's published always-pass test keys, copied from memory, so check them against Cloudflare's docs; no analytics or Cal.com variables yet (D6 platform and P2.7 undecided).
- **CLAUDE.md §13:** changing `.claude/settings.json` normally needs asking; done here because P0.2 explicitly requests it.
- **P0.5 (CI):** run `pnpm knip`, `pnpm format:check` and `pnpm test:e2e` in CI; none are part of `verify`. CI needs `pnpm exec playwright install --with-deps chromium` (cache `~/.cache/ms-playwright`). `playwright.config.ts` already switches to retries + html/github reporters when `CI` is set.
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
pnpm verify       → pass (typecheck → lint → test → build); test step: 1 file, 2 tests passed
pnpm test:e2e     → pass (2 tests, Chromium: smoke + axe WCAG 2.2 AA, ~12 s incl. build)
pnpm knip         → pass
pnpm format:check → pass

P0.4 acceptance:
  pnpm test      → Vitest 5.1.0, jsdom: src/app/page.test.tsx, 2 passed
  pnpm test:e2e  → e2e/smoke.spec.ts, 2 passed; Playwright started and stopped its own server
                   (port 3100 had no listener afterwards)
  Negative check — axe wiring can fail: a throwaway spec scanning
    `<img src="x.png"><button></button>` failed with `image-alt` and `button-name`
    violations (spec deleted afterwards).
  Not done: no manual/visual check; UI is still the stock scaffold page.
```

---

## 10. Proposed commit(s) for the work above

```
test: add vitest and playwright harness with axe checks

Set up Vitest with Testing Library and jsdom for unit and component
tests, and Playwright with @axe-core/playwright for end-to-end and
accessibility checks against a production build. Replace the
placeholder test and test:e2e scripts, add test:watch, and add a
component test plus a smoke test with a WCAG 2.2 AA axe scan so
both runners are exercised. Ignore Playwright output in .gitignore.

Task: P0.4

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Session handoff prompt (copy into a new Claude Code session)

> Read `CLAUDE.md`, `PROJECT_STATE.md` and the current phase in `ROADMAP.md`. Summarise the current state in 3 lines, confirm the active task, then continue. Stop when the task's acceptance criteria are met, run `pnpm verify`, update `PROJECT_STATE.md`, and propose a commit message. Do not commit.
