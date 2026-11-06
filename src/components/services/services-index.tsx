import { useTranslations } from "next-intl";

import { SpotlightCard } from "@/components/fx/spotlight-card";
import { ServicesCta } from "@/components/services/services-cta";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content/schemas";

/**
 * /services: the page's h1 and lead, then the four services (a spotlight card
 * each, linking to its page) and the closing call to action. The cards are
 * the same content as on Home, with the link always present because this page
 * only exists once the detail pages do.
 */
export function ServicesIndex({
  services,
}: {
  services: ReadonlyArray<{ slug: string; data: Service }>;
}) {
  const t = useTranslations("services");

  return (
    <>
      <section className="mx-auto grid w-full max-w-page gap-10 px-gutter pt-16 pb-section">
        <div className="grid gap-6">
          <h1 className="max-w-4xl text-5xl text-text">{t("title")}</h1>
          <p className="max-w-prose text-lg text-text-secondary">{t("lead")}</p>
        </div>
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
