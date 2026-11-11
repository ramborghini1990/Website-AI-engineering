"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useReducer, useRef, useState } from "react";

import {
  DocumentViewer,
  sectionDomId,
} from "@/components/demos/docintel/document-viewer";
import { FieldsView } from "@/components/demos/docintel/fields-view";
import { QaPanel } from "@/components/demos/docintel/qa-panel";
import { useDocCopy } from "@/components/demos/docintel/use-doc-copy";
import { Button } from "@/components/ui/button";
import { docIntelEngine } from "@/lib/demos/docintel/engine";
import { tally } from "@/lib/demos/docintel/extract";
import {
  documentIds,
  documents,
  type DocumentId,
} from "@/lib/demos/docintel/fixtures";
import { currentDoc, initialState, reducer } from "@/lib/demos/docintel/state";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

/** Time between two fields while the document is "read". Skipped under reduced motion. */
const STEP_MS = 220;
const LIMITS = ["upload", "synthetic", "rules", "review", "future"] as const;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Document intelligence, SIMULATION (P3.3): three bundled sample documents, the
 * fields read from each as structured key/value pairs, doubtful values flagged
 * for a person, and questions answered with the exact sentence, page and
 * section they come from. It runs entirely in this page: fixed rules decide,
 * nothing is requested from a server, nothing is stored. There is NO upload and
 * no free-text box: the only inputs are choosing a document and a question.
 *
 * The first document is in the HTML before JavaScript runs (the first state is
 * rendered on the server), so the page reads without it; the controls need
 * JavaScript.
 */
export function DocintelDemo() {
  const t = useTranslations("demos.docIntel");
  const locale = useLocale();
  const reduced = useReducedMotion();
  const sessionId = useId();
  const { text, docText } = useDocCopy();

  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  // A short note about the last thing the visitor did (a source shown); progress and the result are derived.
  const [notice, setNotice] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(
    () => () => {
      run.current += 1; // leaving the page stops a read in progress
    },
    [],
  );

  const id = state.current;
  const spec = documents[id];
  const doc = currentDoc(state);
  const running = doc.phase === "running";
  const done = doc.phase === "done";
  const counts = tally(doc.results, doc.checked);
  const statusLine = running
    ? t("controls.progress", {
        done: doc.results.length,
        total: spec.fields.length,
      })
    : (notice ??
      (done
        ? t("controls.done", {
            total: spec.fields.length,
            ok: counts.read,
            review: counts.review + counts.missing,
          })
        : ""));

  const read = async () => {
    if (doc.phase !== "idle") return;
    const mine = (run.current += 1);
    dispatch({ type: "start" });
    setNotice(null);
    for await (const result of docIntelEngine.run(
      { spec, document: docText(id) },
      { sessionId, locale: locale === "en" ? "en" : "it" },
    )) {
      if (run.current !== mine) return;
      if (!reduced) await sleep(STEP_MS);
      if (run.current !== mine) return;
      dispatch({ type: "field", result });
    }
    if (run.current === mine) dispatch({ type: "finish" });
  };

  const reset = () => {
    run.current += 1;
    dispatch({ type: "reset" });
    setNotice(null);
  };

  const choose = (next: DocumentId) => {
    if (next === id) return;
    run.current += 1; // a read in progress is abandoned
    dispatch({ type: "select-doc", id: next });
    setNotice(t("picker.selected", { name: text(`docs.${next}.name`) }));
  };

  const showSource = (section: string, page: number) => {
    dispatch({ type: "focus", section });
    setNotice(
      t("controls.showing", {
        page,
        section: text(`docs.${id}.sections.${section}.heading`),
      }),
    );
    // On a phone the document sits above: bring the section into view without taking focus.
    document.getElementById(sectionDomId(id, section))?.scrollIntoView({
      block: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <div className="grid grid-cols-1 gap-10">
      <div className="grid max-w-3xl gap-3">
        <p className="text-sm text-text-muted">{t("brand")}</p>
        <p className="text-lg text-text-secondary">{t("intro")}</p>
      </div>

      <div
        data-limits=""
        className="grid max-w-5xl gap-3 border border-border-strong p-6"
      >
        <h3 className="text-xl text-text">{t("limits.title")}</h3>
        <ul className="grid list-disc gap-2 ps-5 text-base text-text-secondary">
          {LIMITS.map((key) => (
            <li key={key}>{t(`limits.${key}`)}</li>
          ))}
        </ul>
      </div>

      <section
        aria-labelledby="di-picker-title"
        className="grid grid-cols-1 content-start gap-4"
      >
        <h3 id="di-picker-title" className="text-2xl text-text">
          {t("picker.title")}
        </h3>
        <p className="text-sm text-text-muted">{t("picker.synthetic")}</p>
        <ul className="grid gap-2 md:grid-cols-3">
          {documentIds.map((option) => (
            <li key={option} className="grid">
              <button
                type="button"
                aria-current={option === id ? "true" : undefined}
                onClick={() => {
                  choose(option);
                }}
                className={cn(
                  "grid min-h-11 content-start gap-1 border px-4 py-3 text-start",
                  option === id
                    ? "border-accent bg-surface-2"
                    : "border-border-strong hover:border-accent",
                )}
              >
                <span className="font-medium text-text">
                  {text(`docs.${option}.name`)}
                </span>
                <span className="text-base text-text-secondary">
                  {text(`docs.${option}.summary`)}
                </span>
                <span className="text-sm text-text-muted">
                  {t("picker.pages", { pages: documents[option].pages })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="lg"
          disabled={doc.phase !== "idle"}
          aria-busy={running}
          onClick={() => {
            void read();
          }}
        >
          {running ? t("controls.reading") : t("controls.read")}
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

      {doc.results.length > 0 ? (
        <dl
          aria-label={t("summary.title")}
          className="flex flex-wrap gap-x-8 gap-y-2 text-base"
        >
          {(
            [
              ["read", counts.read],
              ["review", counts.review],
              ["checked", counts.checked],
              ["missing", counts.missing],
            ] as const
          ).map(([key, count]) => (
            <div key={key} className="flex items-baseline gap-2">
              <dt className="text-text-muted">{t(`summary.${key}`)}</dt>
              <dd className="font-mono text-text">{count}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <DocumentViewer doc={id} results={doc.results} focus={state.focus} />
        <div className="grid grid-cols-1 content-start gap-10">
          <FieldsView
            doc={id}
            results={doc.results}
            checked={doc.checked}
            onSource={showSource}
            onCheck={(field, checked) => {
              dispatch({ type: "check", field, checked });
            }}
          />
          <QaPanel
            doc={id}
            ready={done}
            results={doc.results}
            checked={doc.checked}
            question={state.question}
            onAsk={(question) => {
              setNotice(null);
              dispatch({ type: "ask", question });
            }}
            onSource={showSource}
          />
        </div>
      </div>
    </div>
  );
}

function ResetLabel() {
  const t = useTranslations("demos.shell");
  return <>{t("reset")}</>;
}
