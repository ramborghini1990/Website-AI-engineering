"use client";

import type { RefObject } from "react";

import { gsap } from "@/lib/motion/gsap";
import { duration, ease } from "@/lib/motion/tokens";
import { useMotion } from "@/lib/motion/use-motion";

/** How far outside the control (px) the pull begins. */
const REACH = 48;
/** Fraction of the pointer's offset from the centre that the control follows. */
const PULL = 0.35;
/** The control never travels further than this (px) on either axis. */
const MAX_TRAVEL = 12;

export default function MagneticMotion({
  scope,
}: {
  scope: RefObject<HTMLElement | null>;
}) {
  useMotion(
    ({ reduced }) => {
      const host = scope.current;
      const magnet = host?.querySelector<HTMLElement>("[data-fx-magnet]");
      if (reduced || !host || !magnet) return;

      const moveX = gsap.quickTo(magnet, "x", {
        duration: duration.base,
        ease: ease.out,
      });
      const moveY = gsap.quickTo(magnet, "y", {
        duration: duration.base,
        ease: ease.out,
      });
      const release = () => {
        moveX(0);
        moveY(0);
      };

      const onMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        // Measure the outer span: it never moves, so the target does not run away from the pointer.
        const rect = host.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const near =
          Math.abs(dx) <= rect.width / 2 + REACH &&
          Math.abs(dy) <= rect.height / 2 + REACH;
        if (!near) {
          release();
          return;
        }
        moveX(gsap.utils.clamp(-MAX_TRAVEL, MAX_TRAVEL, dx * PULL));
        moveY(gsap.utils.clamp(-MAX_TRAVEL, MAX_TRAVEL, dy * PULL));
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", release);
      return () => {
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("pointerleave", release);
      };
    },
    { scope },
  );
  return null;
}
