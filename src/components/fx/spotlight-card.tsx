"use client";

import dynamic from "next/dynamic";
import { useRef, type ComponentProps } from "react";

import { useFxReady } from "@/components/fx/use-fx-ready";
import { cn } from "@/lib/utils";

const SpotlightMotion = dynamic(
  () => import("@/components/fx/spotlight-card.motion"),
  { ssr: false },
);

const DISC =
  "pointer-events-none absolute top-0 left-0 size-96 bg-[radial-gradient(closest-side,var(--color-accent),transparent)] opacity-0";

type SpotlightCardProps = Omit<ComponentProps<"div">, "ref"> & {
  /** Classes for the padded surface that holds the children. */
  contentClassName?: string;
};

/**
 * A card whose hairline border and surface light up around a mouse pointer.
 *
 * Two accent discs sit inside the card, transparent until the pointer arrives;
 * only their `transform` and `opacity` change. The 1 px border is the card's
 * own padding, so the lower disc shows through it as an edge highlight, and
 * the upper one adds a faint glow on the surface (strength in `fx-tokens.ts`,
 * contrast proven by `fx-contrast.test.ts`).
 *
 * Without JavaScript, on touch devices and under reduced motion the card is
 * the plain version: hairline border, `surface-2`, no discs visible. Content
 * and focus order are never touched.
 */
export function SpotlightCard({
  className,
  contentClassName,
  children,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ready = useFxReady({ pointer: true });

  return (
    <>
      <div
        {...props}
        ref={ref}
        data-fx="spotlight-card"
        className={cn(
          "relative isolate overflow-hidden rounded-xs bg-border-subtle p-px",
          className,
        )}
      >
        <span aria-hidden="true" data-fx-spot="edge" className={DISC} />
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-xs bg-surface-2 p-6",
            contentClassName,
          )}
        >
          <span aria-hidden="true" data-fx-spot="surface" className={DISC} />
          <div className="relative">{children}</div>
        </div>
      </div>
      {ready ? <SpotlightMotion scope={ref} /> : null}
    </>
  );
}
