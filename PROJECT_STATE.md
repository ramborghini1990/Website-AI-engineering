# PROJECT_STATE.md

Live handoff between sessions. **Hard cap: 8 KB** (a hook warns above it). This file holds only what the *next* session needs to start: focus, open blockers, environment, last gate result. History lives elsewhere and is read on demand:

- Decisions → `docs/state/DECISIONS.md` (grep by `D<n>` or keyword)
- Finished-task reports (defects found, measured / not measured, limits, files touched) → `docs/state/tasks/<TASK>.md`
- Cross-cutting notes and old follow-ups → `docs/state/tasks/general.md`
- Milestones and commits → `docs/state/MILESTONES.md` and `git log`

_Last updated: 2026-11-11 · branch `main` (P3.1 committed as `9b70e3f`)_

## 1. Current focus

| Field | Value |
|---|---|
| Phase | 3 — Agent showcases & funnels (2/7; P3.0 skipped in order, see `docs/state/tasks/P3.1.md`) |
| Active task | `P3.2` LinkedIn outreach agent, SIMULATION at `/[locale]/work/linkedin-assisted-outreach` |
| Status | Built and verified, **awaiting review and commit**. No live mode, by decision (D33, D34) |
| Next task | `P3.0` (demo framework, incl. generic shell texts) or `P3.3` (document intelligence): user's call, do not start unprompted |
| Where I stopped | Nothing half-done. No test servers left running |
| Needs the user | Decisions listed in `docs/state/tasks/P3.2.md` → "Decisions for you"; then review and commit |

## 2. Phase progress

| Phase | Status | Tasks | Note |
|---|---|---|---|
| 0 Setup & governance | ✔ | 7/7 | carry-overs in `docs/state/tasks/general.md` |
| 1 Core, design system, motion | ✔ | 8/8 | closed at task level; Lighthouse a11y, securityheaders grade, CI on `main` not evidenced |
| 2 Landing & value proposition | ✔ | 7/7 | closed at task level; carry-overs in `general.md` |
| 3 Agent showcases & funnels | ◐ | 2/7 | P3.2 awaiting commit |
| 4 GDPR, CI/CD, hardening | ☐ | 0/7 | |

## 3. Open blockers (resolved ones are deleted; their outcome lives in DECISIONS.md)

| # | Blocker | Needed by |
|---|---|---|
| B2 | Fiscal data for the footer (P.IVA, REA, PEC) in `src/lib/business.ts` | before launch |
| B3 | Privacy contact email + inquiry retention period | P4.3 |
| B4 | Legal review of privacy/cookie texts | P4.2 |
| B5 | Vercel Pro plan, MFA, DPA confirmed | P4.7 |
| B6 | Production domain (`NEXT_PUBLIC_SITE_URL`, canonicals, hreflang) | before indexing |
| B7 | P0.7 machine steps (`docs/TOOLING_SETUP.md` §1–2) unconfirmed | — |
| B8 | Final trade name + logo/brand colours | when chosen |
| B9 | About biography; technologies per service (`docs/CONTENT.md` §7) | About page |
| B11 | Header at 360 px: move nav into a Sheet below `md` | before Process/About |
| B12 | `/privacy` page must exist before the form goes live (Art. 13) | form live |
| B13 | EU Postgres, Upstash, Turnstile keys, email provider (see `docs/DEPLOYMENT.md` §3) | form live |
| B14 | Cal.com EU account, host and `NEXT_PUBLIC_CAL_URL` | calendar live |

## 4. Environment & services

Dev needs no external service (in-process stand-ins for DB, limiter, mailbox, Turnstile). Preview/Prod: only Vercel exists (`fra1`, https://website-ai-engineering.vercel.app/); Postgres, Upstash, email, Turnstile not created (B13). Env var names: `.env.example` and `src/lib/env-schema.ts` (a test keeps them in sync). Windows: pnpm shims live in `%USERPROFILE%\.corepack-bin`.

## 5. Last gate run (replace, never append)

```
pnpm agent:gate (P3.2) → PASS 2026-11-11
  typecheck, lint, unit (84 files / 1348 tests), knip, format, build → pass
  e2e 561/561 (chromium + chromium-dev, enforced CSP)
  NOT done: Lighthouse on demo routes; Firefox/WebKit; screen reader; mutation sweep
```

## 6. Rules for updating this file

- Replace sections 1 and 5; never append run histories ("first run had 6 failures…") here. If that story matters, it goes in `docs/state/tasks/<TASK>.md`, max ~15 lines.
- New decision → one row in `docs/state/DECISIONS.md` (Decision ≤ 2 sentences, Why ≤ 1).
- When a task is committed: move its line into `docs/state/MILESTONES.md`, clear "Needs the user".
- The proposed commit message is **not** stored here: it goes in the final reply and in `.agent-logs/COMMIT_MSG.txt`.
