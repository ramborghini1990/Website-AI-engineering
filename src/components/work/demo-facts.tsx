import { Check } from "lucide-react";
import { useTranslations } from "next-intl";

import { demoFacts } from "@/lib/demos/facts";

const badge =
  "inline-flex min-h-6 items-center gap-2 rounded-xs border border-border-strong px-2 py-1 font-mono text-xs text-text-secondary tabular-nums";

/**
 * Honest facts about an interactive demo as badges: counts computed from the
 * demo's fixtures (a trace-coloured dot) and qualities its page states (a
 * success check), all written out as text. At most `max` badges, the first
 * count first, then the qualities, then any other counts. Nothing for a slug
 * that is not an interactive demo.
 */
export function DemoFacts({ slug, max }: { slug: string; max?: number }) {
  const t = useTranslations("work.facts");
  const { counts, qualities } = demoFacts(slug);

  const count = (item: (typeof counts)[number]) => (
    <li key={item.key} className={badge}>
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full bg-trace"
      />
      {t(`counts.${item.key}`, { count: item.count })}
    </li>
  );
  const quality = (item: (typeof qualities)[number]) => (
    <li key={item} className={badge}>
      <span
        aria-hidden="true"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success"
      >
        <Check aria-hidden="true" size={12} className="text-bg" />
      </span>
      {t(`qualities.${item}`)}
    </li>
  );

  const items = [
    ...counts.slice(0, 1).map(count),
    ...qualities.map(quality),
    ...counts.slice(1).map(count),
  ].slice(0, max);
  if (items.length === 0) return null;

  return (
    <ul aria-label={t("title")} className="flex flex-wrap gap-2">
      {items}
    </ul>
  );
}
