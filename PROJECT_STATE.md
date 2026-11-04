# PROJECT_STATE.md

Live handoff file between Claude Code sessions. Claude updates it at the end of every task; you review it with the diff. Keep it short: history belongs in git and ADRs, not here. Sections marked *(rolling)* keep only the latest ~10 entries.

_Last updated: 2026-11-04 · by: Claude Code · branch: `main`_

---

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 0 — Setup, governance & tooling |
| Active task | `P0.1` — Scaffold Next.js 16 + TS strict + Tailwind v4 + pnpm |
| Status | **awaiting review** (acceptance criteria met, not committed) |
| Next task | `P0.2` |

**Plan for the active task**
1. Scaffold with `create-next-app@16.4.5` (TS, Tailwind, ESLint, App Router, `src/`, Turbopack, pnpm) in a scratch dir, then copy into the repo root (it already holds the governance files).
2. Pin the toolchain: `.nvmrc` = `24`, `packageManager: pnpm@12.16.1`, `engines` (`node >=24 <25`, `pnpm >=12.16.1`); rename package to `website-ai-engineering`; align `@types/node` to `^24`.
3. Verify baseline (frozen install, typecheck, lint, build, dev serves `/`), update this file.

**Where I stopped** (exact file/function, what's half-done)
- Nothing half-done. Scaffold is the untouched `create-next-app` default page and styles; first real work is P0.2.

---

## 2. Phase progress

| Phase | Status | Tasks done | Notes |
|---|---|---|---|
| 0 Setup & governance | ◐ | 1/7 | P0.1 awaiting review/commit |
| 1 Core, design system, motion | ☐ | 0/8 | |
| 2 Landing & value proposition | ☐ | 0/7 | |
| 3 Agent showcases & funnels | ☐ | 0/7 | |
| 4 GDPR, CI/CD, hardening | ☐ | 0/7 | |

---

## 3. Completed milestones *(rolling)*

| Date | Task | Summary | Commit (filled by you) |
|---|---|---|---|
| | | | |

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

Env vars added this session (names only, never values):
- none

Local machine note (not in repo): `corepack enable` failed with EPERM on `D:\Program Files\nodejs`, so pnpm shims were created in `%USERPROFILE%\.corepack-bin` (`corepack enable --install-directory`). Add that folder to your user PATH, or run `corepack pnpm …`.

---

## 7. Known issues & tech debt *(rolling)*

| Issue | Impact | Proposed fix | Task |
|---|---|---|---|
| | | | |

---

## 8. Follow-ups noticed (not done)

- **P0.2 / `.gitignore`:** scaffold ignores `.env*` with no `!.env.example` exception; add it when governance files land.
- **P0.3 / `typecheck` script:** `tsc --noEmit` fails on a fresh checkout (`LayoutProps` is a Next-generated global; `next-env.d.ts` and `.next/types` are gitignored). Use `next typegen && tsc --noEmit`. Verified that works from a clean state.
- **P0.3 / scripts:** `pnpm verify`, `typecheck`, `format`, `test`, `test:e2e` do not exist yet; only `dev`, `build`, `start`, `lint`.
- **Decision for you — `next.config.ts`:** the generator enabled `cacheComponents: true` and `partialPrefetching: true` (kept as generated). Cache Components changes how dynamic data/Suspense work and may interact with the P1.4 (next-intl) and P1.7 (CSP nonce) tasks. Keep or turn off before Phase 1.
- **Decision for you — `AGENTS.md`:** generated by `create-next-app`/`next dev` (re-created if deleted); it points to docs in `node_modules/next/dist/docs/`. CLAUDE.md remains the authority. Keep, or add to `.gitignore`.
- **CLAUDE.md §5 wording:** it refers to `pnpm.onlyBuiltDependencies`; pnpm 12 uses `allowBuilds` in `pnpm-workspace.yaml` (currently `sharp: false`, `unrs-resolver: false`). Note `sharp: false` means `next/image` uses no native sharp build; revisit when image optimisation matters.
- **Scaffold leftovers to replace later:** default `README.md`, default page, `Create Next App` metadata and `lang="en"` (P1.4/P2), raw hex in `globals.css` and `next/font/google` Geist (P1.2).
- **Deprecation notice:** pnpm warns `eslint@9.39.5` is deprecated (10.x available); left as scaffolded, decide in P0.3.

---

## 9. Last verification run

```
pnpm verify      → not available yet (added in P0.3); equivalent checks run individually:
  pnpm install --frozen-lockfile → pass
  tsc --noEmit                   → pass (after Next generated route types; also pass from a clean state with `next typegen`)
  pnpm lint --max-warnings=0     → pass
  pnpm build                     → pass (Next 16.4.5 Turbopack; routes: /, /_not-found, both static)
  pnpm dev → GET /               → HTTP 200, default page rendered; server stopped afterwards
  unit tests                     → none yet (harness arrives in P0.4)
pnpm test:e2e    → not run (no UI change beyond the stock page; Playwright arrives in P0.4)
```

---

## 10. Proposed commit(s) for the work above

```
chore: scaffold next.js app with strict typescript

Bootstrap the app with create-next-app 16.4.5 (App Router, src/
directory, Turbopack, Tailwind CSS v4, TypeScript strict, ESLint)
and pin the toolchain so installs are reproducible: .nvmrc for
Node 24, packageManager pnpm@12.16.1, and an engines field. Align
@types/node with the Node 24 runtime.

Task: P0.1

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Session handoff prompt (copy into a new Claude Code session)

> Read `CLAUDE.md`, `PROJECT_STATE.md` and the current phase in `ROADMAP.md`. Summarise the current state in 3 lines, confirm the active task, then continue. Stop when the task's acceptance criteria are met, run `pnpm verify`, update `PROJECT_STATE.md`, and propose a commit message. Do not commit.
