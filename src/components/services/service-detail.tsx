import { Package, Target, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Markdown } from "@/components/content/markdown";
import { Diagram } from "@/components/diagrams/diagram";
import { ServicesCta } from "@/components/services/services-cta";
import { DemoPreview, PREVIEW_PANEL } from "@/components/diagrams/demo-preview";
import { DemoFacts } from "@/components/work/demo-facts";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content/schemas";
import { isInteractiveDemo } from "@/lib/demos/registry";
import { isServiceSlug, serviceDiagrams } from "@/lib/diagrams/services";

const listKeys = ["idealFor", "outcomes", "deliverables"] as const;

const listIcons = {
  idealFor: Users,
  outcomes: Target,
  deliverables: Package,
} as const;

const crumbLink =
  "inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-4 hover:text-text";

/**
 * One service: breadcrumb, the h1 and summary beside the service's
 * architecture diagram (below the summary on a phone), the MDX body, the three
 * lists from the frontmatter (who it is for, what you get, what is delivered)
 * as ledgers, the technologies as tags, an optional demo and the closing call
 * to action.
 *
 * `demo` is the PUBLISHED work entry that demonstrates this service, or null:
 * the page decides (a draft or planned demo is never linked, and neither is a
 * demo page that does not exist yet), so this component just renders what it
 * is given.
 */
export function ServiceDetail({
  slug,
  service,
  body,
  demo,
}: {
  /** The service's slug; it picks the diagram (a slug without one renders the page without a figure). */
  slug: string;
  service: Service;
  body: string;
  demo: { slug: string; title: string } | null;
}) {
  const t = useTranslations("services");
  const nav = useTranslations("nav.items");

  return (
    <>
      <section className="mx-auto w-full max-w-page px-gutter pt-8 pb-section">
        <nav
          aria-label={t("labels.breadcrumb")}
          className="text-sm text-text-muted"
        >
          <ol className="flex flex-wrap items-center gap-x-2">
            <li>
              <Link href="/" className={crumbLink}>
                {nav("home")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/services" className={crumbLink}>
                {t("title")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-text-secondary">
              {service.title}
            </li>
          </ol>
        </nav>
        {/* 12 columns from lg: text in 1-7, the figure in 8-12 beside it. The figure sits
            between the summary and the body in the source, so a phone reads
            summary, figure, body; the second row (1fr) absorbs the figure's height. */}
        <div className="mt-8 grid gap-x-gutter gap-y-12 lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
          <div className="lg:col-span-7">
            <h1 className="max-w-4xl text-5xl text-text">{service.title}</h1>
            <p className="mt-6 max-w-prose text-lg text-text-secondary">
              {service.summary}
            </p>
          </div>
          {isServiceSlug(slug) ? (
            <Diagram
              diagram={serviceDiagrams[slug]}
              namespace={`diagrams.services.${slug}`}
              className="w-full max-w-md lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:self-start"
            />
          ) : null}
          <div className="lg:col-span-7">
            <Markdown body={body} />
          </div>
        </div>
      </section>

      <section className="border-t border-border-subtle">
        <div className="mx-auto grid w-full max-w-page gap-x-8 gap-y-10 px-gutter py-section md:grid-cols-3">
          {listKeys.map((key) => {
            const Icon = listIcons[key];
            return (
              <div
                key={key}
                className="grid content-start gap-4 border-t border-border-strong pt-4"
              >
                <h2 className="flex items-center gap-3 text-xl text-text">
                  <Icon
                    aria-hidden="true"
                    size={24}
                    className="shrink-0 text-text-muted"
                  />
                  {t(`labels.${key}`)}
                </h2>
                <ul className="grid text-base text-text-secondary">
                  {service[key].map((item, index) => (
                    <li
                      key={item}
                      className="grid grid-cols-[auto_1fr] gap-3 border-t border-border-subtle py-3"
                    >
                      <span
                        aria-hidden="true"
                        className="pt-1 font-mono text-xs text-text-muted"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {service.stack.length > 0 ? (
            <div className="grid content-start gap-4 border-t border-border-strong pt-4 md:col-span-3">
              <h2 className="text-xl text-text">{t("labels.stack")}</h2>
              <ul className="flex flex-wrap gap-2">
                {service.stack.map((technology) => (
                  <li
                    key={technology}
                    className="rounded-full border border-border-subtle px-3 py-1 font-mono text-xs text-text-secondary"
                  >
                    {technology}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      {demo ? (
        <section
          aria-labelledby="service-demo"
          className="border-t border-border-subtle"
        >
          <div className="mx-auto grid w-full max-w-page gap-6 px-gutter py-section">
            <h2 id="service-demo" className="text-3xl text-text">
              {t("labels.demo")}
            </h2>
            {/* A preview card: the demo's wireframe, its title as the link and its first facts.
                The title can be long: it wraps instead of pushing the page wider than a phone. */}
            <div
              data-demo-card={demo.slug}
              className="group grid max-w-md content-start overflow-hidden rounded-xs border border-border-strong bg-bg"
            >
              {isInteractiveDemo(demo.slug) ? (
                <div className={PREVIEW_PANEL}>
                  <DemoPreview slug={demo.slug} />
                </div>
              ) : null}
              <div className="grid content-start gap-3 p-6">
                <Link
                  href={`/work/${demo.slug}`}
                  className="inline-flex min-h-11 items-center text-xl text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                >
                  {demo.title}
                </Link>
                <DemoFacts slug={demo.slug} max={2} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <ServicesCta id="service-cta" />
    </>
  );
}
