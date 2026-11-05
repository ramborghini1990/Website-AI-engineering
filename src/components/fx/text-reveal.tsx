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

/**
 * Kinetic headline: the words rise and fade in, once, when the heading scrolls
 * into view.
 *
 * The text is server-rendered complete and in place. Without JavaScript, under
 * reduced motion, or for a heading that is already on screen when the motion
 * loads, nothing animates and nothing is hidden. Assistive technology reads the
 * whole heading from `aria-label`; the split words are `aria-hidden`.
 */
export function TextReveal({
  text,
  as: Tag = "h2",
  className,
}: {
  text: string;
  as?: HeadingTag;
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const ready = useFxReady();
  const words = text.split(/\s+/).filter(Boolean);

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
              <span data-fx-word className="inline-block">
                {word}
              </span>
            </Fragment>
          ))}
        </span>
      </Tag>
      {ready ? <TextRevealMotion scope={ref} /> : null}
    </>
  );
}
