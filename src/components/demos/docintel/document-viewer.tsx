import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useDocCopy } from "@/components/demos/docintel/use-doc-copy";
import type { FieldResult } from "@/lib/demos/docintel/extract";
import { documents, type DocumentId } from "@/lib/demos/docintel/fixtures";
import { cn } from "@/lib/utils";

/** The DOM id of a section, shared by the viewer and whoever scrolls to it. */
export const sectionDomId = (doc: DocumentId, section: string) =>
  `di-${doc}-${section}`;

/** A section's text with the words each field was read from underlined (never colour alone). */
function MarkedText({
  text,
  marks,
}: {
  text: string;
  marks: readonly FieldResult[];
}) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (mark.start < at) continue;
    parts.push(text.slice(at, mark.start));
    parts.push(
      <mark
        key={mark.id}
        data-evidence={mark.id}
        className={cn(
          "bg-transparent text-text underline decoration-2 underline-offset-4",
          mark.status === "review"
            ? "decoration-warning decoration-dashed"
            : "decoration-accent",
        )}
      >
        {text.slice(mark.start, mark.end)}
      </mark>,
    );
    at = mark.end;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/**
 * The sample document, page by page and section by section. It is rendered in
 * its first state on the server, so the document reads without JavaScript. The
 * section a source or a citation points to is outlined and labelled.
 */
export function DocumentViewer({
  doc,
  results,
  focus,
}: {
  doc: DocumentId;
  results: readonly FieldResult[];
  focus: string | null;
}) {
  const t = useTranslations("demos.docIntel.viewer");
  const { text } = useDocCopy();
  const spec = documents[doc];
  const pages = Array.from({ length: spec.pages }, (_, index) => index + 1);

  return (
    <section
      aria-labelledby="di-viewer-title"
      className="grid grid-cols-1 content-start gap-4"
    >
      <h3 id="di-viewer-title" className="text-2xl text-text">
        {t("title")}
      </h3>
      <p className="text-sm text-text-muted">{t("fictional")}</p>
      {results.length > 0 ? (
        <p className="text-sm text-text-muted">{t("evidence")}</p>
      ) : null}

      <div className="grid gap-6 border border-border-strong p-4 sm:p-6">
        <h4 className="text-xl text-text">{text(`docs.${doc}.title`)}</h4>
        {pages.map((page) => (
          <div
            key={page}
            className="grid gap-3 border-t border-border-subtle pt-4"
          >
            <p className="font-mono text-xs text-text-muted">
              {t("page", { page, pages: spec.pages })}
            </p>
            {spec.sections
              .filter((section) => section.page === page)
              .map((section) => {
                const cited = focus === section.id;
                return (
                  <div
                    key={section.id}
                    id={sectionDomId(doc, section.id)}
                    data-section={section.id}
                    data-cited={cited ? "" : undefined}
                    className={cn(
                      "grid gap-1 border-s-4 px-4 py-2",
                      cited
                        ? "border-accent bg-surface-2"
                        : "border-border-subtle",
                    )}
                  >
                    <h5 className="flex flex-wrap items-baseline gap-x-3 text-sm font-medium text-text-secondary">
                      {text(`docs.${doc}.sections.${section.id}.heading`)}
                      {cited ? (
                        <span className="font-mono text-xs text-text uppercase">
                          {t("cited")}
                        </span>
                      ) : null}
                    </h5>
                    <p className="text-base whitespace-pre-line text-text">
                      <MarkedText
                        text={text(`docs.${doc}.sections.${section.id}.text`)}
                        marks={results.filter(
                          (r) =>
                            r.section === section.id && r.status !== "missing",
                        )}
                      />
                    </p>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
