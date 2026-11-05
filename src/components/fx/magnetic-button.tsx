"use client";

import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";

import { useFxReady } from "@/components/fx/use-fx-ready";
import { cn } from "@/lib/utils";

const MagneticMotion = dynamic(
  () => import("@/components/fx/magnetic-button.motion"),
  { ssr: false },
);

/**
 * Wraps ONE interactive element (usually a `Button`) and lets it lean a few
 * pixels toward a nearby mouse pointer.
 *
 * Purely decorative and pointer-only: nothing loads on touch devices, under
 * reduced motion, or before the browser is idle, and the wrapped control is
 * never altered, so focus, keyboard and click behave exactly as without it.
 * It moves an inner `span`, not the control, and measures an outer one that
 * never moves.
 */
export function MagneticButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const ready = useFxReady({ pointer: true });

  return (
    <>
      <span
        ref={ref}
        data-fx="magnetic"
        className={cn("inline-flex", className)}
      >
        <span data-fx-magnet className="inline-flex">
          {children}
        </span>
      </span>
      {ready ? <MagneticMotion scope={ref} /> : null}
    </>
  );
}
