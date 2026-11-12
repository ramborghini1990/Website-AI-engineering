import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Markdown } from "@/components/content/markdown";
import {
  BusinessDetails,
  ProcessorsTable,
  StorageTable,
  ThirdPartiesTable,
} from "@/components/legal/legal-tables";
import { Link } from "@/i18n/navigation";
import {
  legalKeys,
  legalPaths,
  splitLegalBody,
  type LegalFrontmatter,
  type LegalKey,
  type LegalTableName,
} from "@/lib/legal/documents";

const tables: Record<LegalTableName, () => ReactNode> = {
  storage: () => <StorageTable />,
  "third-parties": () => <ThirdPartiesTable />,
  processors: () => <ProcessorsTable />,
  business: () => <BusinessDetails />,
};

/**
 * One legal document (P4.2): the h1 and lead, the version and date (so a reader
 * can tell which text applied when), a visible notice while the text is a draft
 * awaiting professional review, the text, and links to the other documents.
 * The generated tables sit exactly where the text puts its `[[table:...]]` marker.
 */
export function LegalDocument({
  current,
  data,
  body,
}: {
  current: LegalKey;
  data: LegalFrontmatter;
  body: string;
}) {
  const t = useTranslations("legal");
  const format = useFormatter();
  const updated = format.dateTime(new Date(`${data.updated}T12:00:00Z`), {
    dateStyle: "long",
    timeZone: "UTC",
  });

  return (
    <article className="mx-auto grid w-full max-w-page gap-8 px-gutter pt-16 pb-section">
      <header className="grid gap-6">
        <h1 className="max-w-4xl text-5xl text-text">{data.heading}</h1>
        <p className="max-w-prose text-lg text-text-secondary">{data.lead}</p>
        <p className="font-mono text-xs text-text-muted uppercase">
          <span data-legal-version={data.version}>
            {t("versionLine", { version: data.version })}
          </span>
          {" · "}
          <time dateTime={data.updated}>
            {t("updatedLine", { date: updated })}
          </time>
        </p>
        {data.status === "draft" ? (
          <aside
            data-legal-status="draft"
            aria-labelledby="legal-draft-title"
            className="grid max-w-prose gap-1 border-s-2 border-warning bg-surface-2 p-4"
          >
            <p
              id="legal-draft-title"
              className="text-base font-semibold text-text"
            >
              {t("draft.title")}
            </p>
            <p className="text-sm text-text-secondary">{t("draft.body")}</p>
          </aside>
        ) : null}
        <p className="max-w-prose text-sm text-text-muted">
          {t("authoritative")}
        </p>
      </header>

      {/* min-w-0: a grid item may not be narrower than its content by default, and the tables are wider than a phone. */}
      <div className="max-w-page min-w-0">
        {splitLegalBody(body).map((segment, index) =>
          segment.kind === "markdown" ? (
            <Markdown key={index} body={segment.body} />
          ) : (
            <div key={index} className="mb-12">
              {tables[segment.name]()}
            </div>
          ),
        )}
      </div>

      <nav
        aria-label={t("otherDocuments")}
        className="grid gap-3 border-t border-border-strong pt-6"
      >
        <p className="font-mono text-xs text-text-muted uppercase">
          {t("otherDocuments")}
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {legalKeys
            .filter((key) => key !== current)
            .map((key) => (
              <li key={key}>
                <Link
                  href={legalPaths[key]}
                  prefetch={false}
                  className="text-base text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                >
                  {t(`titles.${key}`)}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}
