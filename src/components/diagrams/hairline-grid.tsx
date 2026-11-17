import { cn } from "@/lib/utils";

/**
 * Decorative hairline grid behind a section (docs/DESIGN.md §7, §7.1): 24 px
 * cells in the decorative `border-subtle` colour, faded out towards the right
 * and the bottom. Static, no animation, hidden from assistive technology. Put
 * it as the first child of a `relative` section and make the content `relative`
 * too, so it paints above this layer (no z-index: DESIGN §4 fixes the layers).
 */
export function HairlineGrid({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-hairline-grid
      className={cn(
        "pointer-events-none absolute inset-0 hairline-grid",
        className,
      )}
    />
  );
}
