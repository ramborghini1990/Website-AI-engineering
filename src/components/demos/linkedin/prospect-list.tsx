import { useTranslations } from "next-intl";

import { useStatusText, VerdictBadge } from "@/components/demos/linkedin/parts";
import type { ProspectId } from "@/lib/demos/linkedin/fixtures";
import type { ItemState } from "@/lib/demos/linkedin/state";
import { cn } from "@/lib/utils";

function Row({
  item,
  selected,
  onSelect,
}: {
  item: ItemState;
  selected: boolean;
  onSelect: (id: ProspectId) => void;
}) {
  const t = useTranslations("demos.linkedin");
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
        <span className="font-medium text-text">
          {t(`items.${item.id}.name`)}
        </span>
        <span className="text-base text-text-secondary">
          {t(`items.${item.id}.title`)}, {t(`items.${item.id}.company`)}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          {item.research !== null ? (
            <VerdictBadge verdict={item.research.verdict} />
          ) : null}
          <span>{status}</span>
        </span>
      </button>
    </li>
  );
}

/** The prospects: each row is a real button; the selected one carries `aria-current`. */
export function ProspectList({
  items,
  selectedId,
  onSelect,
}: {
  items: readonly ItemState[];
  selectedId: string | null;
  onSelect: (id: ProspectId) => void;
}) {
  const t = useTranslations("demos.linkedin.prospects");

  return (
    <section
      aria-labelledby="li-prospects-title"
      className="grid grid-cols-1 content-start gap-4"
    >
      <h3 id="li-prospects-title" className="text-2xl text-text">
        {t("title")}
      </h3>
      <p className="text-sm text-text-muted">{t("synthetic")}</p>
      <ul className="grid gap-2">
        {items.map((item) => (
          <Row
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </section>
  );
}
