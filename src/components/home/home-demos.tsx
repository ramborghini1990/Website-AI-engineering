import { useTranslations } from "next-intl";

import { SectionHeader } from "@/components/home/section-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Work } from "@/lib/content/schemas";
import { isPageAvailable } from "@/lib/navigation";

/**
 * Featured interactive demos. It renders NOTHING until at least one demo is
 * published (`getWork()` returns published entries only, and only the ones
 * of kind `demo` are featured here): the four planned
 * demos are drafts, and docs/CONTENT.md forbids advertising a demo that does
 * not exist. Publishing one (`draft: false`, `status: "live"`) makes this
 * section appear. Links to the demo pages and to `/work` appear once those
 * pages exist.
 */
export function HomeDemos({
  demos: published,
  linked = isPageAvailable("work"),
}: {
  demos: ReadonlyArray<{ slug: string; data: Work }>;
  linked?: boolean;
}) {
  const t = useTranslations("home.demos");
  const labels = useTranslations("work.labels");

  // Case studies are not "interactive demos": they have their own place in /work.
  const demos = published.filter(({ data }) => data.kind === "demo");
  if (demos.length === 0) return null;

  return (
    <section
      id="demos"
      aria-labelledby="home-demos"
      className="border-t border-border-subtle"
    >
      <div className="mx-auto grid w-full max-w-page gap-10 px-gutter py-section">
        <SectionHeader id="home-demos" title={t("title")} lead={t("lead")} />
        <ul className="grid gap-px border border-border-subtle bg-border-subtle md:grid-cols-2">
          {demos.map(({ slug, data }) => (
            <li key={slug} className="grid content-start gap-3 bg-bg p-6">
              <span className="font-mono text-xs text-text-muted uppercase">
                {labels("demo")}
              </span>
              <h3 className="text-2xl text-text">
                {linked ? (
                  <Link
                    href={`/work/${slug}`}
                    className="underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-hover"
                  >
                    {data.title}
                  </Link>
                ) : (
                  data.title
                )}
              </h3>
              <p className="text-base text-text-secondary">{data.summary}</p>
              <p className="text-sm text-text-muted">{labels("simulation")}</p>
            </li>
          ))}
        </ul>
        {linked ? (
          <div>
            <Button asChild variant="secondary">
              <Link href="/work">{t("cta")}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
