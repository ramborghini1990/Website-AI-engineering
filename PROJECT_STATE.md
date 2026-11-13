# PROJECT_STATE.md

Live handoff between sessions. **Hard cap: 8 KB** (a hook warns above it). This file holds only what the *next* session needs to start: focus, open blockers, environment, last gate result. History lives elsewhere and is read on demand:

- Decisions → `docs/state/DECISIONS.md` (grep by `D<n>` or keyword)
- Finished-task reports (defects found, measured / not measured, limits, files touched) → `docs/state/tasks/<TASK>.md`
- Cross-cutting notes and old follow-ups → `docs/state/tasks/general.md`
- Milestones and commits → `docs/state/MILESTONES.md` and `git log`

_Last updated: 2026-11-13 · branch `main` (Lighthouse CI committed as `7e8a8c7`; P4.7 uncommitted)_

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 4 — GDPR, CI/CD, hardening (6/7). Phase 3 closed at 6/7: P3.0 deferred by choice (only needed with a live demo mode), P3.6 not needed |
| Active task | `P4.7` Lighthouse performance fixes, gitleaks fix, launch checklist (D45, D46, `docs/state/tasks/P4.7.md`) |
| Status | Gate-green, **awaiting review and commit**. Budget now **met locally on all 5 routes** (perf 0.99–1.0, LCP 762–915 ms, TBT 81–132 ms, script ≤ 285 kB, a11y 1.0) with budgets unchanged; **never run on GitHub**. gitleaks exit 1 reproduced locally (2 synthetic fixtures in `logger.test.ts`), fixed by `.gitleaks.toml`. CI then flagged the P4.7 report itself (it had quoted the fixture; commit `d8f9ffe`): reworded + a commit-pinned exception, **uncommitted**, confirmed on a local scan only. `docs/LAUNCH_CHECKLIST.md` written, **0 items ticked**; `docs/INCIDENTS.md` is a draft. Roadmap P4.7 acceptance ("all items checked") is **not met** |
| Next task | None in the roadmap before launch (Phase 5 is backlog). Work now is yours: launch items, then P3.0 if live demos are wanted. Do not start unprompted |
| Where I stopped | Nothing half-done. No test servers left running |
| Needs the user | **Push, then watch the first GitHub runs** of `ci`, `security` (`--config`) and `lighthouse`; after a few green `lighthouse` runs on `main`, make it required. **Walk `docs/LAUNCH_CHECKLIST.md`** (§0 blockers B2–B14 first) and `GDPR_CHECKLIST.md` (60 unticked). Legal review of `INCIDENTS.md`. **Apply the ruleset** (`DEPLOYMENT.md` §4b, then its 4 verification steps; needs a plan that allows it on a private repo; it blocks direct pushes to `main`). Open from P4.5: Sentry yes/no (legal first, B4), uptime monitor, Vercel budget, Anthropic workspace at P3.0. From P4.4: `SECURITY_CONTACT` in Vercel Production, consent limiter on Upstash, `minimatch` override. From P4.3: notice wording, receipt retention, `CRON_SECRET`, legal review of DSR.md/ROPA.md (B4). Review and commit |

## 2. Phase progress

| Phase | Status | Tasks | Note |
|---|---|---|---|
| 0 Setup & governance | ✔ | 7/7 | carry-overs in `docs/state/tasks/general.md` |
| 1 Core, design system, motion | ✔ | 8/8 | closed at task level; Lighthouse a11y, securityheaders grade, CI on `main` not evidenced |
| 2 Landing & value proposition | ✔ | 7/7 | closed at task level; carry-overs in `general.md` |
| 3 Agent showcases & funnels | ✔ | 6/7 | P3.0 deferred, P3.6 not needed (`docs/state/tasks/P3.1.md`) |
| 4 GDPR, CI/CD, hardening | ◐ | 6/7 | P4.6 committed. P4.7 built (budget met locally, checklist written) but its acceptance, every launch item checked, waits on your accounts |

## 3. Open blockers (resolved ones are deleted; their outcome lives in DECISIONS.md)

| # | Blocker | Needed by |
|---|---|---|
| B2 | Fiscal data for the footer (P.IVA, REA, PEC) in `src/lib/business.ts` | before launch |
| B3 | Privacy contact email + final inquiry retention (730 days is the default and a proposal; DSR.md waits for the address) | launch |
| B4 | Legal review of the four legal texts, banner wording, `docs/DSR.md` and `docs/ROPA.md` (all draft) | before launch |
| B5 | Vercel Pro plan, MFA, DPA confirmed | P4.7 |
| B6 | Production domain (`NEXT_PUBLIC_SITE_URL`, canonicals, hreflang) | before indexing |
| B7 | P0.7 machine steps (`docs/TOOLING_SETUP.md` §1–2) unconfirmed | — |
| B8 | Final trade name + logo/brand colours | when chosen |
| B9 | About biography; technologies per service (`docs/CONTENT.md` §7) | About page |
| B11 | Header at 360 px: move nav into a Sheet below `md` | before Process/About |
| B13 | EU Postgres (name the host in the processor list), Upstash, Turnstile keys, email provider (see `docs/DEPLOYMENT.md` §3); migrations 0002 and **0003** (no consent proof is kept without it) | form live |
| B14 | Cal.com EU account, host and `NEXT_PUBLIC_CAL_URL` | calendar live |

## 4. Environment & services

Dev needs no external service (in-process stand-ins for DB, limiter, mailbox, Turnstile). Preview/Prod: only Vercel exists (`fra1`, https://website-ai-engineering.vercel.app/); Postgres, Upstash, email, Turnstile not created (B13). Env var names: `.env.example` and `src/lib/env-schema.ts` (a test keeps them in sync). Windows: pnpm shims live in `%USERPROFILE%\.corepack-bin`.

## 5. Last gate run (replace, never append)

```
pnpm agent:gate (P4.7) → FULL PASS, 2026-11-13 (second run; the first stopped at a legal-structure unit test, fixed)
  typecheck, lint, unit (117 files / 1902 tests), knip, format, build → pass
  e2e: 749 passed, 0 failed, 0 flaky
  Mutations (scripts/agent/mutations/P4.7.json): 15/15 killed (P4.6.json not re-run)
  Lighthouse (local, median of 5, pnpm lighthouse): exit 0, all budgets met on 5 routes
  gitleaks (local binary 8.30.1, 38 commits incl. d8f9ffe, --config .gitleaks.toml): no leaks
  Follow-up after the push of d8f9ffe: CI flagged the P4.7 report (it quoted the fixture). Line reworded, exception pinned to that commit; agent:check green (52 tests in ci-workflows); full gate not re-run (docs/config/test-only change)
  NOT done: workflows run on GitHub; ruleset applied; live Sentry/monitor/budget accounts; onRequestError at runtime; Observatory, ZAP, HSTS preload (no deployed URL); Firefox/WebKit; real Postgres/Cron (P4.3)
```

## 6. Rules for updating this file

- Replace sections 1 and 5; never append run histories ("first run had 6 failures…") here. If that story matters, it goes in `docs/state/tasks/<TASK>.md`, max ~15 lines.
- New decision → one row in `docs/state/DECISIONS.md` (Decision ≤ 2 sentences, Why ≤ 1).
- When a task is committed: move its line into `docs/state/MILESTONES.md`, clear "Needs the user".
- The proposed commit message is **not** stored here: it goes in the final reply and in `.agent-logs/COMMIT_MSG.txt`.
