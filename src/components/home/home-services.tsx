import { useTranslations } from "next-intl";

import { SectionHeader } from "@/components/home/section-header";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content/schemas";
import { isPageAvailable } from "@/lib/navigation";

/**
 * The four services from the content collection, as spotlight cards. The text
 * is the card; a link to the service page appears only once the services pages
 * exist (`linked`, default from the navigation config): until then the cards
 * are plain, so Home never links to a 404. The section anchor `#services` is
 * the hero's secondary call to action.
 */
export function HomeServices({
  services,
  linked = isPageAvailable("services"),
}: {
  services: ReadonlyArray<{ slug: string; data: Service }>;
  linked?: boolean;
}) {
  const t = useTranslations("home.services");
  const labels = useTranslations("services.labels");

  return (
    <section
      id="services"
      aria-labelledby="home-services"
      className="border-t border-border-subtle"
    >
      <div className="mx-auto grid w-full max-w-page gap-10 px-gutter py-section">
        <SectionHeader id="home-services" title={t("title")} lead={t("lead")} />
        <ul className="grid gap-4 md:grid-cols-2">
          {services.map(({ slug, data }) => (
            <li key={slug} className="grid">
              <SpotlightCard contentClassName="grid h-full content-start gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-xs text-text-muted"
                >
                  {String(data.order).padStart(2, "0")}
                </span>
                <h3 className="text-2xl text-text">{data.title}</h3>
                <p className="text-base text-text-secondary">{data.summary}</p>
                {data.stack.length > 0 ? (
                  <p className="font-mono text-xs text-text-muted">
                    {data.stack.join(" · ")}
                  </p>
                ) : null}
                {linked ? (
                  <Link
                    href={`/services/${slug}`}
                    className="mt-2 inline-flex min-h-11 w-fit items-center text-base text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                  >
                    {labels("learnMore")}
                    <span className="sr-only">: {data.title}</span>
                  </Link>
                ) : null}
              </SpotlightCard>
            </li>
          ))}
        </ul>
        {linked ? (
          <div>
            <Button asChild variant="secondary">
              <Link href="/services">{t("cta")}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
