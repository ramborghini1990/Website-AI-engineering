"use client";

import dynamic from "next/dynamic";
import { Fragment, useRef } from "react";

import { useFxReady } from "@/components/fx/use-fx-ready";

// GSAP stays out of the page's own bundle: this chunk loads after idle, and
// never under reduced motion.
const TextRevealMotion = dynamic(
  () => import("@/components/fx/text-reveal.motion"),
  { ssr: false },
);

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/** docs/DESIGN.md §6.3: 40 ms per word, never more than 600 ms in total. */
const WORD_STAGGER_MS = 40;
const MAX_TOTAL_STAGGER_MS = 600;

/**
 * Kinetic headline: the words rise and fade in.
 *
 * - `when="view"` (default): once, when the heading scrolls into view. GSAP,
 *   loaded after idle. A heading that is already on screen is left alone
 *   (hiding visible text to animate it in would be a flash).
 * - `when="load"`: as the page paints, for a hero headline. **CSS only**: a
 *   keyframe from the `--animate-word-rise` token with a per-word delay, so it
 *   needs no JavaScript, hides nothing that JavaScript must reveal, and plays
 *   from the very first paint (the words are present in the server HTML; the
 *   animation just starts them from an offset). The first word shows at once,
 *   the last after at most 600 ms.
 *
 * Either way the text is server-rendered complete and in place. Without
 * JavaScript it is readable (and in `load` mode still animates); under reduced
 * motion the token is `none` and nothing moves. Assistive technology reads the
 * whole heading from `aria-label`; the split words are `aria-hidden`.
 */
export function TextReveal({
  text,
  as: Tag = "h2",
  when = "view",
  className,
}: {
  text: string;
  as?: HeadingTag;
  when?: "view" | "load";
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const ready = useFxReady();
  const words = text.split(/\s+/).filter(Boolean);
  const onLoad = when === "load";
  const stagger = Math.min(
    WORD_STAGGER_MS,
    MAX_TOTAL_STAGGER_MS / Math.max(words.length - 1, 1),
  );

  return (
    <>
      <Tag
        ref={ref}
        aria-label={text}
        data-fx="text-reveal"
        className={className}
      >
        <span aria-hidden="true">
          {words.map((word, index) => (
            <Fragment key={`${word}-${String(index)}`}>
              {index > 0 ? " " : null}
              <span
                data-fx-word
                className={
                  onLoad ? "inline-block animate-word-rise" : "inline-block"
                }
                style={
                  onLoad
                    ? {
                        animationDelay: `${String(Math.round(index * stagger))}ms`,
                      }
                    : undefined
                }
              >
                {word}
              </span>
            </Fragment>
          ))}
        </span>
      </Tag>
      {ready && !onLoad ? <TextRevealMotion scope={ref} /> : null}
    </>
  );
}
