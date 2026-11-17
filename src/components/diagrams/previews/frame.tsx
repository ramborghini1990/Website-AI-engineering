import type { ReactNode } from "react";

/**
 * The shared shell of the demo previews (docs/DESIGN.md §7.1): a 400 x 250
 * wireframe drawn with abstract bars (no words, no names), decorative, so the
 * card text carries the meaning. Paint is token classes only.
 */
export function PreviewFrame({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 400 250"
      className="h-auto w-full"
      aria-hidden="true"
      focusable="false"
      data-preview={id}
    >
      {children}
    </svg>
  );
}

/** The one accent element of a preview. A work card lifts it on hover and focus (`[&_.preview-accent]`). */
export const ACCENT = "preview-accent fill-accent";
/** A framed panel and a faded text bar. */
export const PANEL = "fill-surface-2 stroke-border-strong";
export const BAR = "fill-surface-3";
/** A stronger bar (a name, a label). */
export const BAR_STRONG = "fill-text-muted";
