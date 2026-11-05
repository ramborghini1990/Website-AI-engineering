"use client";

import dynamic from "next/dynamic";
import { useRef, type ReactNode } from "react";

import { useFxReady } from "@/components/fx/use-fx-ready";
import { cn } from "@/lib/utils";

const PinnedMotion = dynamic(
  () => import("@/components/fx/scroll-pinned-section.motion"),
  { ssr: false },
);

/**
 * The pinned-story pattern (docs/DESIGN.md §6.3): the section sticks to the
 * viewport while scrolling reveals its steps one after another and fills a
 * progress bar. Use at most one per viewport.
 *
 * Every step is server-rendered, visible and in reading order. Without
 * JavaScript, under reduced motion, or when the section is taller than the
 * viewport (small or landscape screens, where pinning would cut content off),
 * it is a plain section of stacked steps: no pin, no scrub, no hidden text.
 *
 * Steps are text: a step that fades in while still invisible would be
 * focusable, so do not put links or controls inside them.
 */
export function ScrollPinnedSection({
  children,
  steps,
  className,
}: {
  /** The section heading and intro, always visible. */
  children: ReactNode;
  steps: readonly ReactNode[];
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const ready = useFxReady();

  return (
    <>
      {/*
        The wrapper is never pinned. ScrollTrigger moves the pinned section into
        a spacer element; if the section were the outermost node React removes
        (a conditional render, a changed key), `removeChild` would fail because
        the section is no longer a child of its original parent.
      */}
      <div data-fx="pinned-section">
        <section
          ref={ref}
          className={cn(
            "flex min-h-dvh flex-col justify-center gap-8",
            className,
          )}
        >
          {children}
          {/* Hidden until the motion pins the section: a full bar means nothing when static. */}
          <div
            aria-hidden="true"
            data-fx-progress-track
            className="invisible h-1 bg-surface-3"
          >
            <div data-fx-progress className="h-full origin-left bg-accent" />
          </div>
          <ol className="grid gap-6">
            {steps.map((step, index) => (
              <li
                // Positional and fixed: steps are never reordered.
                key={index}
                data-fx-step
                className="grid gap-1 border-t border-border-subtle pt-4"
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-xs text-text-muted uppercase"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {ready ? <PinnedMotion scope={ref} /> : null}
    </>
  );
}
