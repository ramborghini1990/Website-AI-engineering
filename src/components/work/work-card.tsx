import { useTranslations } from "next-intl";

import { DemoPreview, PREVIEW_PANEL } from "@/components/diagrams/demo-preview";
import { DemoFacts } from "@/components/work/demo-facts";
import { Link } from "@/i18n/navigation";
import type { Work } from "@/lib/content/schemas";
import { clientDisclosure } from "@/lib/content/work-view";
import { isInteractiveDemo } from "@/lib/demos/registry";

/**
 * One published work entry in the index: for an interactive demo a wireframe
 * preview on top, then the type, title (the link), summary, facts computed from
 * the demo's fixtures, sector, technologies and, only with the client's
 * consent, the client's name. A demo says plainly that it is a simulation. A
 * project entry has no preview and no facts.
 */
export function WorkCard({
  slug,
  data,
  href = `/work/${slug}`,
  index,
}: {
  slug: string;
  data: Work;
  href?: string;
  /** 1-based position in the list, shown as a mono index. */
  index?: number;
}) {
  const labels = useTranslations("work.labels");
  const { client } = clientDisclosure(data);
  const showcase = data.kind === "demo" && isInteractiveDemo(slug);

  return (
    <li className="group grid content-start bg-bg">
      {showcase ? (
        <div className={PREVIEW_PANEL}>
          <DemoPreview slug={slug} />
        </div>
      ) : null}
      <div className="grid content-start gap-3 p-6">
        <p className="flex items-center gap-3 font-mono text-xs text-text-muted uppercase">
          {index === undefined ? null : (
            <span aria-hidden="true">{String(index).padStart(2, "0")}</span>
          )}
          <span>
            {data.kind === "demo" ? labels("demo") : labels("project")}
          </span>
        </p>
        <h2 className="text-2xl text-text">
          <Link
            href={href}
            className="underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-hover"
          >
            {data.title}
          </Link>
        </h2>
        <p className="text-base text-text-secondary">{data.summary}</p>
        {showcase ? <DemoFacts slug={slug} max={3} /> : null}
        <dl className="grid gap-1 text-sm text-text-muted">
          <div className="flex flex-wrap gap-x-2">
            <dt>{labels("sector")}:</dt>
            <dd className="text-text-secondary">{data.sector}</dd>
          </div>
          {client !== null ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>{labels("client")}:</dt>
              <dd className="text-text-secondary">{client}</dd>
            </div>
          ) : null}
        </dl>
        {data.stack.length > 0 ? (
          <ul aria-label={labels("stack")} className="flex flex-wrap gap-2">
            {data.stack.map((technology) => (
              <li
                key={technology}
                className="rounded-full border border-border-subtle px-3 py-1 font-mono text-xs text-text-secondary"
              >
                {technology}
              </li>
            ))}
          </ul>
        ) : null}
        {data.kind === "demo" ? (
          <p className="text-sm text-text-muted">{labels("simulation")}</p>
        ) : null}
      </div>
    </li>
  );
}
