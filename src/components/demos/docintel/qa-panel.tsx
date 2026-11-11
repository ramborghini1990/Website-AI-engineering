import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { useDocCopy } from "@/components/demos/docintel/use-doc-copy";
import { Button } from "@/components/ui/button";
import { answerQuestion, type FieldResult } from "@/lib/demos/docintel/extract";
import { formatValue } from "@/lib/demos/docintel/format";
import { documents, type DocumentId } from "@/lib/demos/docintel/fixtures";
import { cn } from "@/lib/utils";

/** The labels are sentences: let them wrap on a phone instead of widening the page. */
const WRAPPING_BUTTON = "h-auto max-w-full py-2 text-start whitespace-normal";

/**
 * Questions on the document, SIMULATED. The visitor picks one of the document's
 * own questions (there is no text box: nothing typed or uploaded is ever
 * read). The answer is composed from fields already extracted and cites, for
 * each fact, the exact sentence, page and section it comes from; where the
 * document does not say, it says so rather than guess.
 */
export function QaPanel({
  doc,
  ready,
  results,
  checked,
  question,
  onAsk,
  onSource,
}: {
  doc: DocumentId;
  /** The document has been read: answers need its fields. */
  ready: boolean;
  results: readonly FieldResult[];
  /** Flagged fields the person marked as checked. */
  checked: readonly string[];
  question: string | null;
  onAsk: (question: string) => void;
  onSource: (section: string, page: number) => void;
}) {
  const t = useTranslations("demos.docIntel.qa");
  const locale = useLocale();
  const { text, docText } = useDocCopy();
  const outcome = useRef<HTMLDivElement>(null);
  const spec = documents[doc];
  const asked = spec.questions.find((q) => q.id === question) ?? null;
  const answer =
    ready && asked !== null
      ? answerQuestion(asked, results, docText(doc))
      : null;

  // The warning stays until the person has checked every flagged value the answer rests on.
  const unchecked =
    asked !== null &&
    asked.fields.some(
      (field) =>
        results.find((r) => r.id === field)?.status === "review" &&
        !checked.includes(field),
    );

  // The answer is the outcome of the person's action: move focus to it.
  useEffect(() => {
    if (question !== null) outcome.current?.focus();
  }, [question]);

  const values: Record<string, string> = {};
  for (const result of results) {
    if (result.value !== null) {
      values[result.id] = formatValue(result.value, locale);
    }
  }

  return (
    <section
      aria-labelledby="di-qa-title"
      className="grid grid-cols-1 content-start gap-4"
    >
      <h3 id="di-qa-title" className="text-2xl text-text">
        {t("title")}
      </h3>
      <p className="text-sm text-text-muted">{t("hint")}</p>
      {!ready ? (
        <p data-qa-locked="" className="text-base text-text-secondary">
          {t("locked")}
        </p>
      ) : null}
      <ul className="grid gap-2">
        {spec.questions.map((q) => (
          <li key={q.id}>
            <Button
              type="button"
              variant="secondary"
              disabled={!ready}
              aria-pressed={q.id === question}
              className={cn(
                WRAPPING_BUTTON,
                "w-full justify-start",
                q.id === question && "border-accent bg-surface-2",
              )}
              onClick={() => {
                onAsk(q.id);
              }}
            >
              {text(`docs.${doc}.questions.${q.id}.q`)}
            </Button>
          </li>
        ))}
      </ul>

      {answer !== null && asked !== null ? (
        <div
          ref={outcome}
          tabIndex={-1}
          data-answer={answer.status}
          className="grid gap-4 border border-border-strong p-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <h4 className="text-xl text-text">{t("answer")}</h4>
          {answer.status === "answered" ? (
            <>
              <p className="text-lg text-text">
                {text(`docs.${doc}.questions.${asked.id}.a`, values)}
              </p>
              {unchecked ? (
                <p
                  data-needs-check=""
                  className="border-s-4 border-warning ps-4 text-base text-text-secondary"
                >
                  {t("unchecked")}
                </p>
              ) : null}
              <div className="grid gap-3">
                <h5 className="text-sm font-medium text-text-secondary">
                  {t("sources")}
                </h5>
                <ul className="grid gap-3">
                  {answer.citations.map((citation) => (
                    <li
                      key={`${citation.section}-${citation.quote}`}
                      data-citation={citation.section}
                      className="grid gap-1 border-s-4 border-accent ps-4"
                    >
                      <q className="text-base text-text">{citation.quote}</q>
                      <div>
                        <Button
                          type="button"
                          variant="tertiary"
                          className={WRAPPING_BUTTON}
                          onClick={() => {
                            onSource(citation.section, citation.page);
                          }}
                        >
                          {t("source", {
                            page: citation.page,
                            section: text(
                              `docs.${doc}.sections.${citation.section}.heading`,
                            ),
                          })}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg text-text">{t("notFound")}</p>
              <p className="text-base text-text-secondary">{t("noSource")}</p>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
