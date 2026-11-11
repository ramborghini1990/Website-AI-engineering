"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useReducer, useRef, useState } from "react";

import { ProspectDetail } from "@/components/demos/linkedin/prospect-detail";
import { ProspectList } from "@/components/demos/linkedin/prospect-list";
import { ScheduleQueue } from "@/components/demos/linkedin/schedule-queue";
import { Button } from "@/components/ui/button";
import { draftMessage } from "@/lib/demos/linkedin/draft";
import { linkedinEngine } from "@/lib/demos/linkedin/engine";
import { prospects, type Prospect } from "@/lib/demos/linkedin/fixtures";
import type { Qualification, Verdict } from "@/lib/demos/linkedin/qualify";
import {
  initialState,
  reducer,
  scheduledItems,
  statistics,
} from "@/lib/demos/linkedin/state";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

/** Time between two prospects while the agent "researches" the list. Skipped under reduced motion. */
const STEP_MS = 450;
const VERDICTS: readonly Verdict[] = ["draft", "hold", "skip", "blocked"];
const COMPLIANCE = ["official", "assisted", "qualify", "minimal"] as const;
const FORBIDDEN = ["scraping", "automation", "bulk", "unapproved"] as const;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Assisted sales outreach, SIMULATION (P3.2): invented prospects, the agent's
 * research card and fit rating, a drafted first message and a mandatory human
 * approval before anything is "scheduled". It runs entirely in this page: fixed
 * rules decide, nothing is requested from a server, no platform is contacted,
 * nothing is stored. The approval gate is enforced by the reducer
 * (`lib/demos/linkedin/state.ts`), not only by a disabled button.
 *
 * The prospect list is in the HTML before JavaScript runs (the first state is
 * rendered on the server), so the page reads without it; the controls need
 * JavaScript.
 */
export function LinkedinDemo() {
  const t = useTranslations("demos.linkedin");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const sessionId = useId();

  const [state, dispatch] = useReducer(reducer, prospects, initialState);
  // A short note about the last thing the visitor did (a selection); progress and the result are derived.
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0);
  const detail = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      run.current += 1; // leaving the page stops a run in progress
    },
    [],
  );

  const draftFor = (prospect: Prospect, research: Qualification) => {
    const name = t(`items.${prospect.id}.name`);
    const company = t(`items.${prospect.id}.company`);
    return draftMessage(research, {
      greeting: t("draft.greeting", { name: name.split(" ")[0] ?? name }),
      hook:
        prospect.news !== null
          ? t("draft.hookNews", { company, signal: t(`news.${prospect.news}`) })
          : t("draft.hookAbout", {
              company,
              about: t(`items.${prospect.id}.about`),
            }),
      value: t("draft.value"),
      ask: t("draft.ask"),
      optOut: t("draft.optOut"),
      signOff: t("draft.signOff"),
    });
  };

  const stats = statistics(state);
  const running = state.phase === "running";
  // What the live region says: progress while the agent works, else the last note, else the result.
  const statusLine = running
    ? t("controls.progress", { done: stats.researched, total: stats.total })
    : (notice ??
      (state.phase === "done"
        ? t("controls.done", {
            total: stats.total,
            drafts: stats.drafts,
            pending: stats.pending,
          })
        : ""));
  const selected =
    state.items.find((item) => item.id === state.selectedId) ?? null;
  const scheduled = scheduledItems(state);

  const research = async () => {
    if (running) return;
    const mine = (run.current += 1);
    const waiting = state.items.filter((item) => item.research === null);
    dispatch({ type: "start" });
    setNotice(null);
    for await (const step of linkedinEngine.run(
      { prospects: waiting },
      { sessionId, locale: locale === "en" ? "en" : "it" },
    )) {
      if (run.current !== mine) return;
      if (!reduced) await sleep(STEP_MS);
      if (run.current !== mine) return;
      const prospect = waiting.find((candidate) => candidate.id === step.id);
      if (prospect === undefined) continue;
      dispatch({
        type: "researched",
        id: step.id,
        research: step.research,
        draft: draftFor(prospect, step.research),
      });
    }
    dispatch({ type: "finish" });
  };

  const reset = () => {
    run.current += 1;
    dispatch({ type: "reset", prospects });
    setNotice(null);
  };

  const select = (id: string) => {
    dispatch({ type: "select", id });
    const item = state.items.find((candidate) => candidate.id === id);
    if (item !== undefined) {
      setNotice(t("prospects.selected", { name: t(`items.${item.id}.name`) }));
    }
    // On a phone the detail sits below the list: bring it into view without taking focus.
    detail.current?.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const counts = VERDICTS.map((verdict) => ({
    verdict,
    count: state.items.filter((item) => item.research?.verdict === verdict)
      .length,
  }));

  return (
    <div className="grid grid-cols-1 gap-10">
      <div className="grid max-w-3xl gap-3">
        <p className="text-sm text-text-muted">{t("brand")}</p>
        <p className="text-lg text-text-secondary">{t("intro")}</p>
      </div>

      <div
        data-compliance=""
        className="grid max-w-5xl gap-6 border border-border-strong p-6 md:grid-cols-2"
      >
        <div className="grid content-start gap-3">
          <h3 className="text-xl text-text">{t("compliance.title")}</h3>
          <ul className="grid list-disc gap-2 ps-5 text-base text-text-secondary">
            {COMPLIANCE.map((key) => (
              <li key={key}>{t(`compliance.${key}`)}</li>
            ))}
          </ul>
        </div>
        <div className="grid content-start gap-3 border-t border-border-subtle pt-6 md:border-s md:border-t-0 md:ps-6 md:pt-0">
          <h3 className="text-xl text-text">{t("forbidden.title")}</h3>
          <ul className="grid list-disc gap-2 ps-5 text-base text-text-secondary">
            {FORBIDDEN.map((key) => (
              <li key={key}>{t(`forbidden.${key}`)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid max-w-3xl gap-1 border-s-4 border-accent ps-4 text-base text-text-secondary">
        <p className="font-medium text-text">{t("boundary.title")}</p>
        <p>{t("boundary.auto")}</p>
        <p>{t("boundary.approval")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="lg"
          disabled={running || stats.researched === stats.total}
          aria-busy={running}
          onClick={() => {
            void research();
          }}
        >
          {running ? t("controls.researching") : t("controls.research")}
        </Button>
        <Button type="button" variant="secondary" size="lg" onClick={reset}>
          {/* The label belongs to the shell's messages: the same word for every demo. */}
          <ResetLabel />
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="text-base text-text-secondary"
        >
          {statusLine}
        </p>
      </div>

      {stats.researched > 0 ? (
        <dl
          aria-label={t("summary.title")}
          className="flex flex-wrap gap-x-8 gap-y-2 text-base"
        >
          {counts.map(({ verdict, count }) => (
            <div key={verdict} className="flex items-baseline gap-2">
              <dt className="text-text-muted">{t(`verdict.${verdict}`)}</dt>
              <dd className="font-mono text-text">{count}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <ProspectList
          items={state.items}
          selectedId={state.selectedId}
          onSelect={select}
        />
        <div ref={detail}>
          {selected !== null ? (
            <ProspectDetail
              key={selected.id}
              item={selected}
              onEdit={(id, draft) => {
                dispatch({ type: "edit", id, draft });
              }}
              onReview={(id, reviewed) => {
                dispatch({ type: "review", id, reviewed });
              }}
              onApprove={(id) => {
                dispatch({ type: "approve", id });
              }}
              onDiscard={(id) => {
                dispatch({ type: "discard", id });
              }}
            />
          ) : null}
        </div>
      </div>

      <ScheduleQueue items={scheduled} onSelect={select} />
    </div>
  );
}

function ResetLabel() {
  const t = useTranslations("demos.shell");
  return <>{t("reset")}</>;
}
