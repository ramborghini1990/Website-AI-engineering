import { useTranslations } from "next-intl";

import type { Verdict } from "@/lib/demos/linkedin/qualify";
import type { ItemState } from "@/lib/demos/linkedin/state";
import { cn } from "@/lib/utils";

/** Left bar colour per verdict: a token, and never the only signal (the label is text). */
const TONE: Record<Verdict, string> = {
  draft: "border-l-accent",
  hold: "border-l-warning",
  skip: "border-l-border-strong",
  blocked: "border-l-danger",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const t = useTranslations("demos.linkedin.verdict");

  return (
    <span
      className={cn(
        "inline-flex items-center border border-l-4 border-border-strong px-2 py-0.5 text-sm text-text",
        TONE[verdict],
      )}
    >
      {t(verdict)}
    </span>
  );
}

/** The one-line state of a prospect: waiting, or what the person decided. */
export function useStatusText(item: ItemState): string {
  const t = useTranslations("demos.linkedin.status");

  if (item.research === null) return t("new");
  if (item.decision === "scheduled") return t("scheduled");
  if (item.decision === "discarded") return t("discarded");
  return item.research.verdict === "draft"
    ? t("pending")
    : t(item.research.verdict);
}
