import { useTranslations } from "next-intl";

import { Diagram } from "@/components/diagrams/diagram";
import { ServiceGlyph } from "@/components/diagrams/service-glyph";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { ServicesCta } from "@/components/services/services-cta";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content/schemas";
import { capabilityMap, serviceCardId } from "@/lib/diagrams/capability-map";
import { isServiceSlug } from "@/lib/diagrams/services";

/**
 * /services: the page's h1 and lead beside the capability map (the four areas
 * as one connected column, its legend linking to the cards), then the four
 * services (a spotlight card each, with its glyph, linking to its page) and the
 * closing call to action. The cards are the same content as on Home, with the
 * link always present because this page only exists once the detail pages do.
 */
export function ServicesIndex({
  services,
}: {
  services: ReadonlyArray<{ slug: string; data: Service }>;
}) {
  const t = useTranslations("services");

  return (
    <>
      <section className="mx-auto grid w-full max-w-page gap-x-gutter gap-y-10 px-gutter pt-16 pb-section lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
        <div className="grid content-start gap-6 lg:col-span-7">
          <h1 className="max-w-4xl text-5xl text-text">{t("title")}</h1>
          <p className="max-w-prose text-lg text-text-secondary">{t("lead")}</p>
        </div>
        <Diagram
          diagram={capabilityMap}
          namespace="diagrams.capabilityMap"
          stepHref={(step) => `#${serviceCardId(step)}`}
          className="w-full max-w-md lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-start"
        />
        <ul className="grid gap-4 md:grid-cols-2 lg:col-span-7 lg:grid-cols-1">
          {services.map(({ slug, data }) => (
            <li
              key={slug}
              id={isServiceSlug(slug) ? serviceCardId(slug) : undefined}
              className="grid scroll-mt-24"
            >
              <SpotlightCard contentClassName="grid h-full content-start gap-3">
                <div className="flex items-center justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-text-muted"
                  >
                    {String(data.order).padStart(2, "0")}
                  </span>
                  {isServiceSlug(slug) ? (
                    <span className="w-20 shrink-0">
                      <ServiceGlyph slug={slug} />
                    </span>
                  ) : null}
                </div>
                <h2 className="text-2xl text-text">{data.title}</h2>
                <p className="text-base text-text-secondary">{data.summary}</p>
                {data.stack.length > 0 ? (
                  <p className="font-mono text-xs text-text-muted">
                    {data.stack.join(" · ")}
                  </p>
                ) : null}
                <Link
                  href={`/services/${slug}`}
                  className="mt-2 inline-flex min-h-11 w-fit items-center text-base text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                >
                  {t("labels.learnMore")}
                  <span className="sr-only">: {data.title}</span>
                </Link>
              </SpotlightCard>
            </li>
          ))}
        </ul>
      </section>
      <ServicesCta id="services-cta" />
    </>
  );
}
