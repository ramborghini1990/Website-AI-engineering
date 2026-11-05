"use client";

import type { RefObject } from "react";

import { gsap } from "@/lib/motion/gsap";
import { duration, ease, revealOffset } from "@/lib/motion/tokens";
import { useMotion } from "@/lib/motion/use-motion";

/** Same threshold as the scroll trigger below: "top 85%" of the viewport. */
const TRIGGER_AT = 0.85;
/** docs/DESIGN.md §6.3: stagger of 40 ms per item, never more than 600 ms in total. */
const WORD_STAGGER = 0.04;
const MAX_TOTAL_STAGGER = 0.6;

export default function TextRevealMotion({
  scope,
}: {
  scope: RefObject<HTMLElement | null>;
}) {
  useMotion(
    ({ reduced }) => {
      const heading = scope.current;
      if (reduced || !heading) return;
      // Already past the trigger line (on screen, or scrolled past): leave it
      // as rendered. Hiding visible text to animate it in would be a flash.
      if (heading.getBoundingClientRect().top < window.innerHeight * TRIGGER_AT)
        return;

      const words = gsap.utils.toArray<HTMLElement>("[data-fx-word]", heading);
      gsap.from(words, {
        opacity: 0,
        y: revealOffset,
        duration: duration.reveal,
        ease: ease.out,
        stagger: Math.min(
          WORD_STAGGER,
          MAX_TOTAL_STAGGER / Math.max(words.length - 1, 1),
        ),
        scrollTrigger: { trigger: heading, start: "top 85%", once: true },
      });
    },
    { scope },
  );
  return null;
}
