"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useReducer, useRef, useState } from "react";

import { useDemoCompleted } from "@/components/demos/demo-funnel";
import { DetailPanel } from "@/components/demos/instagram/detail-panel";
import { InboxList } from "@/components/demos/instagram/inbox-list";
import { LeadBoard } from "@/components/demos/instagram/lead-board";
import { TryIt } from "@/components/demos/instagram/try-it";
import { Button } from "@/components/ui/button";
import {
  analyze,
  type Analysis,
  type Category,
} from "@/lib/demos/instagram/analyze";
import { draftSentences, draftText } from "@/lib/demos/instagram/draft";
import { instagramEngine, type InboxItem } from "@/lib/demos/instagram/engine";
import { fixtures } from "@/lib/demos/instagram/fixtures";
import {
  initialState,
  reducer,
  statistics,
  type ItemState,
} from "@/lib/demos/instagram/state";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

/** Time between two items while the agent "works through" the inbox. Skipped under reduced motion. */
const STEP_MS = 450;
const CATEGORIES: readonly Category[] = ["inquiry", "lead", "support", "spam"];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Instagram engagement and lead agent, SIMULATION (P3.1): a made-up inbox, the
 * agent's analysis (type, reasons, lead score, sources, reply draft) and a
 * human approval step before any action. It runs entirely in this page: the
 * rules in `lib/demos/instagram` classify, nothing is requested from a server,
 * nothing is stored, and the visitor's own test message stays in memory.
 *
 * The inbox is in the HTML before JavaScript runs (the first state is rendered
 * on the server), so the page reads without it; the controls need JavaScript.
 */
export function InstagramDemo() {
  const t = useTranslations("demos.instagram");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const sessionId = useId();

  const inbox: InboxItem[] = fixtures.map((fixture) => ({
    ...fixture,
    text: t(`items.${fixture.id}.text`),
  }));
  const [state, dispatch] = useReducer(reducer, inbox, initialState);
  // Done = the person approved at least one of the agent's actions.
  useDemoCompleted(
    "instagram-lead-agent",
    state.items.some((item) => item.decision === "approved"),
  );
  // A short note about the last thing the visitor did (a selection); progress and the result are derived.
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0);
  const custom = useRef(0);
  const detail = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      run.current += 1; // leaving the page stops a run in progress
    },
    [],
  );

  const draftFor = (item: InboxItem, analysis: Analysis): string | null => {
    const sentences = draftSentences(
      { kind: item.kind, analysis },
      {
        greeting:
          item.kind === "dm"
            ? t("reply.greetingDm", { handle: item.handle })
            : t("reply.greetingComment"),
        closing:
          item.kind === "dm" ? t("reply.closingDm") : t("reply.closingComment"),
        lead: t("reply.lead"),
        supportAsk: t("reply.supportAsk"),
        answer: (source) => t(`kb.${source}.answer`),
      },
    );
    return sentences === null ? null : draftText(sentences);
  };

  const stats = statistics(state);
  const running = state.phase === "running";
  // What the live region says: progress while the agent works, else the last note, else the result.
  const statusLine = running
    ? t("controls.progress", { done: stats.analysed, total: stats.total })
    : (notice ??
      (state.phase === "done"
        ? t("controls.done", {
            total: stats.total,
            leads: stats.leads,
            pending: stats.pending,
          })
        : ""));
  const selected =
    state.items.find((item) => item.id === state.selectedId) ?? null;

  const analyzeInbox = async () => {
    if (running) return;
    const mine = (run.current += 1);
    const waiting = state.items.filter((item) => item.analysis === null);
    dispatch({ type: "start" });
    setNotice(null);
    for await (const step of instagramEngine.run(
      { items: waiting },
      { sessionId, locale: locale === "en" ? "en" : "it" },
    )) {
      if (run.current !== mine) return;
      if (!reduced) await sleep(STEP_MS);
      if (run.current !== mine) return;
      const item = waiting.find((candidate) => candidate.id === step.id);
      if (item === undefined) continue;
      dispatch({
        type: "analyzed",
        id: step.id,
        analysis: step.analysis,
        draft: draftFor(item, step.analysis),
      });
    }
    dispatch({ type: "finish" });
  };

  const reset = () => {
    run.current += 1;
    dispatch({ type: "reset", items: inbox });
    setNotice(null);
  };

  const select = (id: string) => {
    dispatch({ type: "select", id });
    const item = state.items.find((candidate) => candidate.id === id);
    if (item !== undefined) {
      setNotice(t("inbox.selected", { handle: item.handle }));
    }
    // On a phone the detail sits below the list: bring it into view without taking focus.
    detail.current?.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  const addCustom = (text: string) => {
    custom.current += 1;
    const base: InboxItem = {
      id: `custom-${String(custom.current)}`,
      kind: "dm",
      handle: t("try.handle"),
      text,
    };
    const analysis = analyze(text);
    const item: ItemState = {
      ...base,
      analysis,
      draft: draftFor(base, analysis),
      decision: null,
    };
    dispatch({ type: "add", item });
    setNotice(t("inbox.selected", { handle: base.handle }));
  };

  const counts = CATEGORIES.map((category) => ({
    category,
    count: state.items.filter((item) => item.analysis?.category === category)
      .length,
  }));

  return (
    <div className="grid grid-cols-1 gap-10">
      <div className="grid max-w-3xl gap-3">
        <p className="text-sm text-text-muted">{t("brand")}</p>
        <p className="text-lg text-text-secondary">{t("intro")}</p>
        <div className="grid gap-1 border-s-4 border-accent ps-4 text-base text-text-secondary">
          <p className="font-medium text-text">{t("boundary.title")}</p>
          <p>{t("boundary.auto")}</p>
          <p>{t("boundary.approval")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="lg"
          disabled={running || stats.analysed === stats.total}
          aria-busy={running}
          onClick={() => {
            void analyzeInbox();
          }}
        >
          {running ? t("controls.analyzing") : t("controls.analyze")}
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

      {stats.analysed > 0 ? (
        <dl
          aria-label={t("summary.title")}
          className="flex flex-wrap gap-x-8 gap-y-2 text-base"
        >
          {counts.map(({ category, count }) => (
            <div key={category} className="flex items-baseline gap-2">
              <dt className="text-text-muted">{t(`category.${category}`)}</dt>
              <dd className="font-mono text-text">{count}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <InboxList
          items={state.items}
          filter={state.filter}
          selectedId={state.selectedId}
          onFilter={(filter) => {
            dispatch({ type: "filter", filter });
          }}
          onSelect={select}
        />
        <div ref={detail}>
          {selected !== null ? (
            <DetailPanel
              key={selected.id}
              item={selected}
              onEdit={(id, draft) => {
                dispatch({ type: "edit", id, draft });
              }}
              onDecide={(id, decision) => {
                dispatch({ type: "decide", id, decision });
              }}
            />
          ) : null}
        </div>
      </div>

      <LeadBoard items={state.items} onSelect={select} />
      <TryIt onSubmit={addCustom} />
    </div>
  );
}

function ResetLabel() {
  const t = useTranslations("demos.shell");
  return <>{t("reset")}</>;
}
