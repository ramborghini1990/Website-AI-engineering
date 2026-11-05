"use client";

import type { RefObject } from "react";

import { gsap } from "@/lib/motion/gsap";
import { ease, revealOffset } from "@/lib/motion/tokens";
import { useMotion } from "@/lib/motion/use-motion";

/** Scroll distance (in viewport heights) the scene lasts, per step. */
const VIEWPORTS_PER_STEP = 0.75;

export default function PinnedMotion({
  scope,
}: {
  scope: RefObject<HTMLElement | null>;
}) {
  useMotion(
    ({ reduced }) => {
      const section = scope.current;
      if (reduced || !section) return;
      // Pinning content taller than the viewport would cut it off (reflow,
      // WCAG 1.4.10): keep the static stacked layout there.
      if (section.offsetHeight > window.innerHeight + 1) return;

      const steps = gsap.utils.toArray<HTMLElement>("[data-fx-step]", section);
      const track = section.querySelector<HTMLElement>(
        "[data-fx-progress-track]",
      );
      const bar = section.querySelector<HTMLElement>("[data-fx-progress]");
      if (steps.length < 2 || !track || !bar) return;

      gsap.set(track, { autoAlpha: 1 });

      // One unit of timeline time per step; scrubbed, so it is scroll distance.
      const scene = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () =>
            `+=${String(Math.round(window.innerHeight * VIEWPORTS_PER_STEP * steps.length))}`,
          pin: true,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
      scene.fromTo(
        bar,
        { scaleX: 0 },
        { scaleX: 1, ease: ease.linear, duration: steps.length },
        0,
      );
      // The first step is visible from the start; each next one fades in just before its unit.
      steps.slice(1).forEach((step, index) => {
        scene.from(
          step,
          { opacity: 0, y: revealOffset, ease: ease.inOut, duration: 0.5 },
          index + 0.5,
        );
      });
    },
    { scope },
  );
  return null;
}
