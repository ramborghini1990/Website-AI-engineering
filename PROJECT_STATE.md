# PROJECT_STATE.md

Live handoff between sessions. **Hard cap: 8 KB** (a hook warns above it). This file holds only what the *next* session needs to start: focus, open blockers, environment, last gate result. History lives elsewhere and is read on demand:

- Decisions → `docs/state/DECISIONS.md` (grep by `D<n>` or keyword)
- Finished-task reports (defects found, measured / not measured, limits, files touched) → `docs/state/tasks/<TASK>.md`
- Cross-cutting notes and old follow-ups → `docs/state/tasks/general.md`
- Milestones and commits → `docs/state/MILESTONES.md` and `git log`

_Last updated: 2026-11-12 · branch `main` (P4.2 committed as `1d687f2`; P4.3 uncommitted)_

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 4 — GDPR, CI/CD, hardening (3/7). Phase 3 closed at 6/7: P3.0 deferred by choice (only needed with a live demo mode), P3.6 not needed |
| Active task | `P4.3` Data subject rights & retention: DSR CLI, purge cron, `docs/DSR.md`, `docs/ROPA.md` (D40, `docs/state/tasks/P4.3.md`) |
| Status | Built and verified, **awaiting review and commit**. Not run against a real Postgres or a real Vercel Cron (B13, B5). Last full gate: clean pass (732/732 e2e) |
| Next task | `P4.4` Hardening (CSP enforced, security.txt, audit, ZAP): do not start unprompted |
| Where I stopped | Nothing half-done. No test servers left running |
| Needs the user | Decisions in `P4.3.md` → "Decisions for you" (notice wording "from last contact" vs the purge's `created_at`; retention of receipts and of the request register; `data_events` table or not; DB trigger making receipts immutable). Set `CRON_SECRET` in Vercel Production. Legal review of DSR.md and ROPA.md (B4). Review and commit |

## 2. Phase progress

| Phase | Status | Tasks | Note |
|---|---|---|---|
| 0 Setup & governance | ✔ | 7/7 | carry-overs in `docs/state/tasks/general.md` |
| 1 Core, design system, motion | ✔ | 8/8 | closed at task level; Lighthouse a11y, securityheaders grade, CI on `main` not evidenced |
| 2 Landing & value proposition | ✔ | 7/7 | closed at task level; carry-overs in `general.md` |
| 3 Agent showcases & funnels | ✔ | 6/7 | P3.0 deferred, P3.6 not needed (`docs/state/tasks/P3.1.md`) |
| 4 GDPR, CI/CD, hardening | ◐ | 3/7 | P4.3 awaiting commit |

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
pnpm agent:gate (P4.3) → CLEAN PASS, 2026-11-12 (2nd full run; 1st failed on a 5 s test timeout, fixed)
  typecheck, lint, unit (103 files / 1739 tests), knip, format, build, e2e 732/732 → pass
  NOT done: real Postgres run of the DSR tool and purge; real Vercel Cron call; Lighthouse; Firefox/WebKit; mutation sweep
```

## 6. Rules for updating this file

- Replace sections 1 and 5; never append run histories ("first run had 6 failures…") here. If that story matters, it goes in `docs/state/tasks/<TASK>.md`, max ~15 lines.
- New decision → one row in `docs/state/DECISIONS.md` (Decision ≤ 2 sentences, Why ≤ 1).
- When a task is committed: move its line into `docs/state/MILESTONES.md`, clear "Needs the user".
- The proposed commit message is **not** stored here: it goes in the final reply and in `.agent-logs/COMMIT_MSG.txt`.
