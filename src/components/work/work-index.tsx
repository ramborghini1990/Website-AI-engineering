import { useTranslations } from "next-intl";

import { ContactCta } from "@/components/content/contact-cta";
import { WorkCard } from "@/components/work/work-card";
import { WorkFilterBar } from "@/components/work/work-filters";
import { Link } from "@/i18n/navigation";
import type { Work } from "@/lib/content/schemas";
import {
  filterOptions,
  filterWork,
  workHref,
  type WorkFilters,
} from "@/lib/content/work-filter";

/**
 * /work: the h1 and lead, the filters, the published entries and the closing
 * call to action. `entries` must already be the PUBLISHED ones (`getWork()`
 * leaves drafts out). With none, the page says so plainly (`work.empty`)
 * instead of showing filters for nothing; with filters that match nothing it
 * says that and offers to clear them.
 */
export function WorkIndex({
  entries,
  filters,
  basePath = "/work",
  entryHref = (slug) => `/work/${slug}`,
}: {
  entries: ReadonlyArray<{ slug: string; data: Work }>;
  filters: WorkFilters;
  /** Where the filter links point; only the dev fixtures page changes it. */
  basePath?: string;
  /** Where a card links to; only the dev fixtures page changes it. */
  entryHref?: (slug: string) => string;
}) {
  const t = useTranslations("work");
  const options = filterOptions(entries);
  const shown = filterWork(entries, filters);

  return (
    <>
      <section className="mx-auto grid w-full max-w-page gap-10 px-gutter pt-16 pb-section">
        <div className="grid gap-6">
          <h1 className="max-w-4xl text-5xl text-text">{t("title")}</h1>
          <p className="max-w-prose text-lg text-text-secondary">{t("lead")}</p>
        </div>

        {entries.length === 0 ? (
          <div className="grid max-w-prose gap-3 border-t border-border-strong pt-6">
            <h2 className="text-2xl text-text">{t("empty.title")}</h2>
            <p className="text-base text-text-secondary">{t("empty.body")}</p>
          </div>
        ) : (
          <>
            <WorkFilterBar
              options={options}
              filters={filters}
              basePath={basePath}
            />
            <p className="text-sm text-text-muted">
              {t("filters.count", { count: shown.length })}
            </p>
            {shown.length > 0 ? (
              <ul className="grid gap-px border border-border-subtle bg-border-subtle md:grid-cols-2">
                {shown.map(({ slug, data }) => (
                  <WorkCard
                    key={slug}
                    slug={slug}
                    data={data}
                    href={entryHref(slug)}
                  />
                ))}
              </ul>
            ) : (
              <div className="grid max-w-prose gap-3">
                <p className="text-base text-text-secondary">
                  {t("filters.noResults")}
                </p>
                <Link
                  href={workHref({}, basePath)}
                  className="inline-flex min-h-11 w-fit items-center text-base text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                >
                  {t("filters.clear")}
                </Link>
              </div>
            )}
          </>
        )}
      </section>
      <ContactCta
        id="work-cta"
        title={t("cta.title")}
        body={t("cta.body")}
        label={t("cta.cta")}
      />
    </>
  );
}
