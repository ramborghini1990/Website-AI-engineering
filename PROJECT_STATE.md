# PROJECT_STATE.md

Live handoff between sessions. **Hard cap: 8 KB** (a hook warns above it). This file holds only what the *next* session needs to start: focus, open blockers, environment, last gate result. History lives elsewhere and is read on demand:

- Decisions → `docs/state/DECISIONS.md` (grep by `D<n>` or keyword)
- Finished-task reports (defects found, measured / not measured, limits, files touched) → `docs/state/tasks/<TASK>.md`
- Cross-cutting notes and old follow-ups → `docs/state/tasks/general.md`
- Milestones and commits → `docs/state/MILESTONES.md` and `git log`

_Last updated: 2026-11-17 · branch `main` (P4.6/P4.7 committed; V1 and V2 uncommitted)_

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 6 — Visual storytelling (V1, V2 of V1–V5; titles of V3–V5 are provisional). Phase 4 is 6/7: P4.7 built, its acceptance (every launch item checked) waits on your accounts |
| Active task | `V2` Service architecture diagrams, glyphs, capability map (D49–D51, `docs/state/tasks/V2.md`); V1 (D47, D48) is still uncommitted underneath it |
| Status | Gate-green, **awaiting review and commit** (one message covering V1 + V2). Zero client JS, no dependency, CSP unchanged. `docs/DESIGN.md` §7.1 approved; hero grid is `lg:items-start`. Lighthouse not run (CI only; `/it/services/ai-agents` added to its URLs) |
| Next task | None unprompted. V3 (work case-study diagrams); it also restyles the demo section of the service page |
| Where I stopped | Nothing half-done. No scratch files |
| Needs the user | Review and commit V1 + V2 (message in `.agent-logs/COMMIT_MSG.txt`). Content decision: the service texts do not mention Server Components / Server Actions / Zod or a validate/transform step, so the diagrams omit them; extend the texts first if you want them drawn. Still open from P4.7: push and watch the first GitHub runs (`ci`, `security`, `lighthouse`), walk `docs/LAUNCH_CHECKLIST.md` (§0 blockers first) and `GDPR_CHECKLIST.md`, legal review of `INCIDENTS.md`, apply the ruleset (`DEPLOYMENT.md` §4b), Sentry yes/no, uptime monitor, Vercel budget, `SECURITY_CONTACT`, consent limiter on Upstash, `CRON_SECRET`, legal review of DSR.md/ROPA.md (B4) |

## 2. Phase progress

| Phase | Status | Tasks | Note |
|---|---|---|---|
| 0 Setup & governance | ✔ | 7/7 | carry-overs in `docs/state/tasks/general.md` |
| 1 Core, design system, motion | ✔ | 8/8 | closed at task level |
| 2 Landing & value proposition | ✔ | 7/7 | closed at task level |
| 3 Agent showcases & funnels | ✔ | 6/7 | P3.0 deferred, P3.6 not needed (`docs/state/tasks/P3.1.md`) |
| 4 GDPR, CI/CD, hardening | ◐ | 6/7 | P4.7 acceptance waits on your accounts |
| 6 Visual storytelling | ◐ | 2/5 | V1 and V2 built and gate-green, uncommitted; §7.1 approved |

## 3. Open blockers (resolved ones are deleted; their outcome lives in DECISIONS.md)

| # | Blocker | Needed by |
|---|---|---|
| B2 | Fiscal data for the footer (P.IVA, REA, PEC) in `src/lib/business.ts` | before launch |
| B3 | Privacy contact email + final inquiry retention (730 days is the default and a proposal) | launch |
| B4 | Legal review of the four legal texts, banner wording, `docs/DSR.md` and `docs/ROPA.md` (all draft) | before launch |
| B5 | Vercel Pro plan, MFA, DPA confirmed | P4.7 |
| B6 | Production domain (`NEXT_PUBLIC_SITE_URL`, canonicals, hreflang) | before indexing |
| B7 | P0.7 machine steps (`docs/TOOLING_SETUP.md` §1–2) unconfirmed | — |
| B8 | Final trade name + logo/brand colours | when chosen |
| B9 | About biography; technologies per service (`docs/CONTENT.md` §7) | About page |
| B11 | Header at 360 px: move nav into a Sheet below `md` | before Process/About |
| B13 | EU Postgres, Upstash, Turnstile keys, email provider (`docs/DEPLOYMENT.md` §3); migrations 0002 and **0003** | form live |
| B14 | Cal.com EU account, host and `NEXT_PUBLIC_CAL_URL` | calendar live |

## 4. Environment & services

Dev needs no external service (in-process stand-ins for DB, limiter, mailbox, Turnstile). Preview/Prod: only Vercel exists (`fra1`, https://website-ai-engineering.vercel.app/); Postgres, Upstash, email, Turnstile not created (B13). Env var names: `.env.example` and `src/lib/env-schema.ts`. Windows: pnpm shims live in `%USERPROFILE%\.corepack-bin`. Playwright Chromium build 1254 was installed this session (the dependency bump had moved the version).

## 5. Last gate run (replace, never append)

```
pnpm agent:gate (V2, covers V1) → FULL PASS, 2026-11-17 (third run; see docs/state/tasks/V2.md)
  typecheck, lint, unit (124 files / 2091 tests), knip, format, build → pass
  e2e: 789 passed, 0 failed, 0 flaky
  Mutations: V1 12/12 killed (earlier run), V2 10/10 killed (scripts/agent/mutations/V2.json)
  Earlier runs: unit failed on ci-workflows.test.ts (Lighthouse URL list, new ai-agents URL), e2e on gallery.spec.ts (assumed hero-only gallery); both tests updated, not weakened
  NOT done: Lighthouse (CI); Firefox/WebKit; real forced-colours and screen-reader checks; workflows on GitHub; ruleset applied
```

## 6. Rules for updating this file

- Replace sections 1 and 5; never append run histories ("first run had 6 failures…") here. If that story matters, it goes in `docs/state/tasks/<TASK>.md`, max ~15 lines.
- New decision → one row in `docs/state/DECISIONS.md` (Decision ≤ 2 sentences, Why ≤ 1).
- When a task is committed: move its line into `docs/state/MILESTONES.md`, clear "Needs the user".
- The proposed commit message is **not** stored here: it goes in the final reply and in `.agent-logs/COMMIT_MSG.txt`.
