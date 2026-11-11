import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ContactCta } from "@/components/content/contact-cta";
import { Markdown } from "@/components/content/markdown";
import { Link } from "@/i18n/navigation";
import type { Work } from "@/lib/content/schemas";
import { clientDisclosure } from "@/lib/content/work-view";

const crumbLink =
  "inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-4 hover:text-text";
const textLink =
  "text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover";

/**
 * One published work entry: breadcrumb, type and h1, summary, the facts
 * (sector, the service it belongs to, technologies, and ONLY with the client's
 * consent the client and the results), the MDX body and the call to action.
 * A demo states that it is a simulation with synthetic data.
 */
export function WorkDetail({
  work,
  body,
  service,
  demo = null,
}: {
  work: Work;
  body: string;
  /** The service this entry belongs to, when it exists. */
  service: { slug: string; title: string } | null;
  /** The interactive demo of this entry (P3.x), shown after the summary. */
  demo?: ReactNode;
}) {
  const t = useTranslations("work");
  const nav = useTranslations("nav.items");
  const { client, outcomes } = clientDisclosure(work);

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
              <Link href="/work" className={crumbLink}>
                {t("title")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-text-secondary">
              {work.title}
            </li>
          </ol>
        </nav>
        <p className="mt-8 font-mono text-xs text-text-muted uppercase">
          {work.kind === "demo" ? t("labels.demo") : t("labels.project")}
        </p>
        <h1 className="mt-3 max-w-4xl text-5xl text-text">{work.title}</h1>
        <p className="mt-6 max-w-prose text-lg text-text-secondary">
          {work.summary}
        </p>
        {work.kind === "demo" ? (
          <p className="mt-4 max-w-prose text-sm text-text-muted">
            {t("labels.simulation")}
          </p>
        ) : null}

        {demo !== null ? <div className="mt-12">{demo}</div> : null}

        <dl className="mt-10 grid max-w-3xl gap-x-8 gap-y-4 border-t border-border-strong pt-6 sm:grid-cols-[max-content_1fr]">
          <dt className="text-text-muted">{t("labels.sector")}</dt>
          <dd className="text-text-secondary">{work.sector}</dd>
          {client !== null ? (
            <>
              <dt className="text-text-muted">{t("labels.client")}</dt>
              <dd className="text-text-secondary">{client}</dd>
            </>
          ) : null}
          {service ? (
            <>
              <dt className="text-text-muted">{t("labels.service")}</dt>
              <dd>
                <Link href={`/services/${service.slug}`} className={textLink}>
                  {service.title}
                </Link>
              </dd>
            </>
          ) : null}
          {work.stack.length > 0 ? (
            <>
              <dt className="text-text-muted">{t("labels.stack")}</dt>
              <dd className="font-mono text-sm text-text-secondary">
                {work.stack.join(" · ")}
              </dd>
            </>
          ) : null}
        </dl>

        {outcomes.length > 0 ? (
          <div className="mt-10 grid max-w-3xl gap-4">
            <h2 className="text-2xl text-text">{t("labels.outcomes")}</h2>
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
              {outcomes.map((outcome) => (
                <div key={outcome.label} className="contents">
                  <dt className="text-text-muted">{outcome.label}</dt>
                  <dd className="text-text-secondary">{outcome.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="mt-12">
          <Markdown body={body} />
        </div>
      </section>
      <ContactCta
        id="work-detail-cta"
        title={t("cta.title")}
        body={t("cta.body")}
        label={t("cta.cta")}
        query={`service=${work.service}`}
      />
    </>
  );
}
