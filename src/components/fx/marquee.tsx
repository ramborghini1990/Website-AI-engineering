import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

const ITEM =
  "border-l border-border-strong px-5 font-mono text-xs whitespace-nowrap text-text-muted uppercase";

/**
 * Technical ticker: a looping row of short labels (stack, protocols, tools).
 *
 * Server component, no JavaScript. The loop is a CSS animation (transform only,
 * `--animate-marquee`); it pauses while the pointer is over it and while the
 * "pause" switch is checked (a real checkbox, so it works with the keyboard and
 * without JS: WCAG 2.2.2 needs a way to stop content that moves for over 5 s).
 *
 * Reduced motion (animation token set to `none`): the second copy and the
 * switch are hidden and the single list wraps onto several lines, so every item
 * stays readable and nothing is clipped.
 *
 * Each copy is stretched to at least the viewport width (`min-w-screen`, items
 * spread evenly) so the loop never shows a gap on a wide screen; both copies
 * stay identical, which is what makes the -50% loop seamless. Use at least 5-6
 * items or the spacing gets sparse. Items are plain text: the second copy is
 * `aria-hidden`, so it must hold nothing focusable.
 */
export function Marquee({
  items,
  label,
  pauseLabel,
  secondsPerItem = 5,
  className,
}: {
  items: readonly string[];
  /** Accessible name of the list (translated by the caller). */
  label: string;
  /** Visible label of the pause switch (translated by the caller). */
  pauseLabel: string;
  /** Speed: seconds each item takes to cross. Higher is slower. */
  secondsPerItem?: number;
  className?: string;
}) {
  const loopSeconds = Math.max(items.length * secondsPerItem, 20);

  return (
    <div data-fx="marquee" className={cn("group/ticker grid gap-2", className)}>
      <div
        className="group/viewport overflow-hidden motion-reduce:overflow-visible"
        style={
          { "--marquee-duration": `${String(loopSeconds)}s` } as CSSProperties
        }
      >
        <div className="flex w-max animate-marquee group-hover/viewport:animation-paused group-has-[:checked]/ticker:animation-paused motion-reduce:w-auto">
          <ul
            aria-label={label}
            className="flex min-w-screen shrink-0 items-center justify-around py-2 motion-reduce:min-w-0 motion-reduce:shrink motion-reduce:flex-wrap motion-reduce:justify-start motion-reduce:gap-y-2"
          >
            {items.map((item) => (
              <li key={item} className={ITEM}>
                {item}
              </li>
            ))}
          </ul>
          <ul
            aria-hidden="true"
            className="flex min-w-screen shrink-0 items-center justify-around py-2 motion-reduce:hidden"
          >
            {items.map((item) => (
              <li key={item} className={ITEM}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <label className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-3 text-sm text-text-secondary motion-reduce:hidden">
        <input type="checkbox" className="size-5 accent-accent" />
        {pauseLabel}
      </label>
    </div>
  );
}
