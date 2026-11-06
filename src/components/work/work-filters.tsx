import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  withFilter,
  workHref,
  type FilterKey,
  type WorkFilterOptions,
  type WorkFilters,
} from "@/lib/content/work-filter";
import { cn } from "@/lib/utils";

const optionClass = cn(
  "inline-flex min-h-11 items-center border border-border-strong px-4 text-base text-text-secondary",
  "hover:border-accent hover:text-text",
);
const currentClass = "border-accent bg-surface-2 text-text";

/**
 * Type, sector and technology filters as plain links to `/work?...`: they work
 * without JavaScript, a filtered view is a URL, and the server renders it. They
 * are navigation (`aria-current`), not an ARIA tab widget, because choosing one
 * loads a different list rather than switching panels on the same page. A group
 * with fewer than two options is left out: there is nothing to choose.
 */
export function WorkFilterBar({
  options,
  filters,
  basePath = "/work",
}: {
  options: WorkFilterOptions;
  filters: WorkFilters;
  basePath?: string;
}) {
  const t = useTranslations("work.filters");
  const labels = useTranslations("work.labels");

  const groups: Array<{
    key: FilterKey;
    title: string;
    values: Array<{ value: string; label: string }>;
  }> = [
    {
      key: "kind",
      title: t("type"),
      values: options.kind.map((kind) => ({
        value: kind,
        label: kind === "demo" ? labels("demo") : labels("project"),
      })),
    },
    {
      key: "sector",
      title: t("sector"),
      values: options.sector.map((value) => ({ value, label: value })),
    },
    {
      key: "stack",
      title: t("stack"),
      values: options.stack.map((value) => ({ value, label: value })),
    },
  ];
  const shown = groups.filter((group) => group.values.length >= 2);
  if (shown.length === 0) return null;

  return (
    <nav aria-label={t("label")} className="grid gap-6">
      {shown.map((group) => {
        const labelId = `work-filter-${group.key}`;
        return (
          <div key={group.key} className="grid gap-2">
            <p
              id={labelId}
              className="font-mono text-xs text-text-muted uppercase"
            >
              {group.title}
            </p>
            <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
              <li>
                <Link
                  href={workHref(
                    withFilter(filters, group.key, undefined),
                    basePath,
                  )}
                  aria-current={
                    filters[group.key] === undefined ? "true" : undefined
                  }
                  className={cn(
                    optionClass,
                    filters[group.key] === undefined && currentClass,
                  )}
                >
                  {t("all")}
                </Link>
              </li>
              {group.values.map(({ value, label }) => {
                const current = filters[group.key] === value;
                return (
                  <li key={value}>
                    <Link
                      href={workHref(
                        withFilter(filters, group.key, value),
                        basePath,
                      )}
                      aria-current={current ? "true" : undefined}
                      className={cn(optionClass, current && currentClass)}
                    >
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
