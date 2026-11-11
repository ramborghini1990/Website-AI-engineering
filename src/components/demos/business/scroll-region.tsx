import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A box that may scroll (a wide table on a phone, a long list of days): named,
 * and reachable with the keyboard, so that a person who cannot use a pointer
 * can still scroll it. The name is the table's own caption.
 */
export function ScrollRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      // A scrollable box must be focusable, or a keyboard user cannot scroll it (axe: scrollable-region-focusable, WCAG 2.1.1).
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={cn("min-w-0 overflow-auto", className)}
    >
      {children}
    </div>
  );
}
