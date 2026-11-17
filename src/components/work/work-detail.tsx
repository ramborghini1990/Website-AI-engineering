import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { ContactCta } from "@/components/content/contact-cta";
import { Markdown } from "@/components/content/markdown";
import { Diagram } from "@/components/diagrams/diagram";
import { DemoFacts } from "@/components/work/demo-facts";
import { Link } from "@/i18n/navigation";
import type { Work } from "@/lib/content/schemas";
import { clientDisclosure } from "@/lib/content/work-view";
import { isInteractiveDemo } from "@/lib/demos/registry";
import { demoDiagrams } from "@/lib/diagrams/demos";

const crumbLink =
  "inline-flex min-h-11 items-center underline decoration-border-strong underline-offset-4 hover:text-text";
const textLink =
  "text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover";

/** One line of the facts readout: a mono caption over a tabular value, between hairlines. */
function ReadoutRow({
  label,
  mono = false,
  children,
}: {
  label: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-border-subtle py-3">
      <dt className="font-mono text-xs text-text-muted uppercase">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-sm text-text-secondary tabular-nums"
            : "text-text-secondary tabular-nums"
        }
      >
        {children}
      </dd>
    </div>
  );
}

/**
 * One published work entry: breadcrumb, type and h1, summary, the facts
 * (sector, the service it belongs to, technologies, and ONLY with the client's
 * consent the client and the results), the MDX body and the call to action.
 * A demo states that it is a simulation with synthetic data.
 */
export function WorkDetail({
  slug,
  work,
  body,
  service,
  demo = null,
}: {
  /** The entry's slug; it picks the preview facts and the "how it works" diagram of an interactive demo. */
  slug: string;
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
  const showcase =
    work.kind === "demo" && isInteractiveDemo(slug) ? slug : null;

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
        {/* From lg: the title block in columns 1-8 and the readout rail (the facts)
            in columns 9-12; below lg the rail follows the summary. */}
        <div className="mt-8 grid gap-x-gutter gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <p className="font-mono text-xs text-text-muted uppercase">
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
          </div>

          <div
            data-rail="facts"
            className="grid content-start gap-6 lg:col-span-4 lg:col-start-9"
          >
            <dl className="border-t border-border-strong">
              <ReadoutRow label={t("labels.sector")}>{work.sector}</ReadoutRow>
              {client !== null ? (
                <ReadoutRow label={t("labels.client")}>{client}</ReadoutRow>
              ) : null}
              {service ? (
                <ReadoutRow label={t("labels.service")}>
                  <Link href={`/services/${service.slug}`} className={textLink}>
                    {service.title}
                  </Link>
                </ReadoutRow>
              ) : null}
              {work.stack.length > 0 ? (
                <ReadoutRow label={t("labels.stack")} mono>
                  {work.stack.join(" · ")}
                </ReadoutRow>
              ) : null}
            </dl>
            {showcase ? <DemoFacts slug={showcase} /> : null}
          </div>
        </div>

        {demo !== null ? <div className="mt-12">{demo}</div> : null}

        {showcase ? (
          <div className="mt-12 grid gap-6">
            <h2 className="text-2xl text-text">{t("labels.howItWorks")}</h2>
            <Diagram
              diagram={demoDiagrams[showcase]}
              namespace={`diagrams.demos.${showcase}`}
              className="w-full max-w-md"
            />
          </div>
        ) : null}

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
