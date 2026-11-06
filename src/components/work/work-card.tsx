import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import type { Work } from "@/lib/content/schemas";
import { clientDisclosure } from "@/lib/content/work-view";

/**
 * One published work entry in the index: type, title (the link), summary,
 * sector, technologies and, only with the client's consent, the client's name.
 * A demo says plainly that it is a simulation.
 */
export function WorkCard({
  slug,
  data,
  href = `/work/${slug}`,
}: {
  slug: string;
  data: Work;
  href?: string;
}) {
  const labels = useTranslations("work.labels");
  const { client } = clientDisclosure(data);

  return (
    <li className="grid content-start gap-3 bg-bg p-6">
      <span className="font-mono text-xs text-text-muted uppercase">
        {data.kind === "demo" ? labels("demo") : labels("project")}
      </span>
      <h2 className="text-2xl text-text">
        <Link
          href={href}
          className="underline decoration-accent decoration-2 underline-offset-4 hover:text-accent-hover"
        >
          {data.title}
        </Link>
      </h2>
      <p className="text-base text-text-secondary">{data.summary}</p>
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
        <p className="font-mono text-xs text-text-muted">
          {data.stack.join(" · ")}
        </p>
      ) : null}
      {data.kind === "demo" ? (
        <p className="text-sm text-text-muted">{labels("simulation")}</p>
      ) : null}
    </li>
  );
}
