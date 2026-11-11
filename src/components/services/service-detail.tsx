import { useTranslations } from "next-intl";

import { Markdown } from "@/components/content/markdown";
import { ServicesCta } from "@/components/services/services-cta";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Service } from "@/lib/content/schemas";

const listKeys = ["idealFor", "outcomes", "deliverables"] as const;

const crumbLink =
  "inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-4 hover:text-text";

/**
 * One service: breadcrumb, the h1 and summary, the MDX body, the three lists
 * from the frontmatter (who it is for, what you get, what is delivered), the
 * technologies, an optional demo and the closing call to action.
 *
 * `demo` is the PUBLISHED work entry that demonstrates this service, or null:
 * the page decides (a draft or planned demo is never linked, and neither is a
 * demo page that does not exist yet), so this component just renders what it
 * is given.
 */
export function ServiceDetail({
  service,
  body,
  demo,
}: {
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
        <h1 className="mt-8 max-w-4xl text-5xl text-text">{service.title}</h1>
        <p className="mt-6 max-w-prose text-lg text-text-secondary">
          {service.summary}
        </p>
        <div className="mt-12">
          <Markdown body={body} />
        </div>
      </section>

      <section className="border-t border-border-subtle">
        <div className="mx-auto grid w-full max-w-page gap-x-8 gap-y-10 px-gutter py-section md:grid-cols-3">
          {listKeys.map((key) => (
            <div
              key={key}
              className="grid content-start gap-4 border-t border-border-strong pt-4"
            >
              <h2 className="text-xl text-text">{t(`labels.${key}`)}</h2>
              <ul className="grid list-disc gap-2 ps-6 text-base text-text-secondary">
                {service[key].map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
          {service.stack.length > 0 ? (
            <div className="grid content-start gap-4 border-t border-border-strong pt-4 md:col-span-3">
              <h2 className="text-xl text-text">{t("labels.stack")}</h2>
              <p className="font-mono text-sm text-text-secondary">
                {service.stack.join(" · ")}
              </p>
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
            <div>
              {/* The title can be long: let it wrap instead of pushing the page wider than a phone. */}
              <Button
                asChild
                variant="secondary"
                size="lg"
                className="h-auto max-w-full py-3 text-start whitespace-normal"
              >
                <Link href={`/work/${demo.slug}`}>{demo.title}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <ServicesCta id="service-cta" />
    </>
  );
}
