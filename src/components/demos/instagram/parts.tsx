import { MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Category } from "@/lib/demos/instagram/analyze";
import { doneAction, type ItemState } from "@/lib/demos/instagram/state";
import { cn } from "@/lib/utils";

/** Left bar colour per category: a token, and never the only signal (the label is text). */
const TONE: Record<Category, string> = {
  inquiry: "border-l-trace",
  lead: "border-l-accent",
  support: "border-l-warning",
  spam: "border-l-danger",
};

export function CategoryBadge({ category }: { category: Category }) {
  const t = useTranslations("demos.instagram.category");

  return (
    <span
      className={cn(
        "inline-flex items-center border border-l-4 border-border-strong px-2 py-0.5 text-sm text-text",
        TONE[category],
      )}
    >
      {t(category)}
    </span>
  );
}

/** The one-line state of an item: waiting, or what was done after the person decided. */
export function useStatusText(item: ItemState): string {
  const t = useTranslations("demos.instagram.status");

  if (item.analysis === null) return t("new");
  if (item.decision === "rejected") return t("rejected");
  const done = doneAction(item);
  return done === null ? t("pending") : t(done);
}

export function KindIcon({ kind }: { kind: ItemState["kind"] }) {
  const Icon = kind === "dm" ? Send : MessageSquare;
  return (
    <Icon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
  );
}
