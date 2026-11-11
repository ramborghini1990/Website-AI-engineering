import { useTranslations } from "next-intl";

import {
  CategoryBadge,
  KindIcon,
  useStatusText,
} from "@/components/demos/instagram/parts";
import type { Filter, ItemState } from "@/lib/demos/instagram/state";
import { cn } from "@/lib/utils";

const FILTERS: readonly Filter[] = ["all", "dm", "comment"];

function Row({
  item,
  selected,
  onSelect,
}: {
  item: ItemState;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("demos.instagram.inbox");
  const status = useStatusText(item);

  return (
    <li>
      <button
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={() => {
          onSelect(item.id);
        }}
        className={cn(
          "grid min-h-11 w-full gap-1 border px-4 py-3 text-start",
          selected
            ? "border-accent bg-surface-2"
            : "border-border-strong hover:border-accent",
        )}
      >
        <span className="flex items-center gap-2 font-medium text-text">
          <KindIcon kind={item.kind} />
          {item.handle}
          <span className="sr-only">
            {item.kind === "dm" ? t("dmLabel") : t("commentLabel")}
          </span>
        </span>
        <span className="line-clamp-2 text-base text-text-secondary">
          {item.text}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          {item.analysis !== null ? (
            <CategoryBadge category={item.analysis.category} />
          ) : null}
          <span>{status}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * The inbox: a filter (all, messages, comments) and the list. Each row is a
 * real button; the selected one carries `aria-current`.
 */
export function InboxList({
  items,
  filter,
  selectedId,
  onFilter,
  onSelect,
}: {
  items: readonly ItemState[];
  filter: Filter;
  selectedId: string | null;
  onFilter: (filter: Filter) => void;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("demos.instagram.inbox");
  const shown = items.filter(
    (item) => filter === "all" || item.kind === filter,
  );

  return (
    <section
      aria-labelledby="ig-inbox-title"
      className="grid grid-cols-1 content-start gap-4"
    >
      <h3 id="ig-inbox-title" className="text-2xl text-text">
        {t("title")}
      </h3>
      <div
        role="group"
        aria-label={t("filterLabel")}
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => {
              onFilter(value);
            }}
            className={cn(
              "inline-flex min-h-11 items-center border px-4 text-base text-text-secondary",
              filter === value
                ? "border-accent bg-surface-2 text-text"
                : "border-border-strong hover:border-accent",
            )}
          >
            {t(value)}
          </button>
        ))}
      </div>
      {shown.length > 0 ? (
        <ul className="grid gap-2">
          {shown.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : (
        <p className="text-base text-text-muted">{t("empty")}</p>
      )}
    </section>
  );
}
