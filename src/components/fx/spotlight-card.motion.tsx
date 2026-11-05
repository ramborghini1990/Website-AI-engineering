"use client";

import type { RefObject } from "react";

import { spotlightSurfaceOpacity } from "@/components/fx/fx-tokens";
import { gsap } from "@/lib/motion/gsap";
import { duration, ease } from "@/lib/motion/tokens";
import { useMotion } from "@/lib/motion/use-motion";

export default function SpotlightMotion({
  scope,
}: {
  scope: RefObject<HTMLElement | null>;
}) {
  useMotion(
    ({ reduced, contextSafe }) => {
      const card = scope.current;
      const edge = card?.querySelector<HTMLElement>('[data-fx-spot="edge"]');
      const surface = card?.querySelector<HTMLElement>(
        '[data-fx-spot="surface"]',
      );
      if (reduced || !card || !edge || !surface) return;

      // Centre both discs on the pointer; they then only translate and fade.
      const discs = [edge, surface];
      gsap.set(discs, { xPercent: -50, yPercent: -50 });
      const moveX = gsap.quickTo(discs, "x", {
        duration: duration.base,
        ease: ease.out,
      });
      const moveY = gsap.quickTo(discs, "y", {
        duration: duration.base,
        ease: ease.out,
      });

      const place = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };
      const onMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const { x, y } = place(event);
        moveX(x);
        moveY(y);
      };
      // These create tweens later, so they must be context-safe or the revert misses them.
      const onEnter = contextSafe((event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        // Start under the pointer, not at the corner the discs rest in.
        gsap.set(discs, place(event));
        gsap.to(edge, {
          opacity: 1,
          duration: duration.fast,
          overwrite: "auto",
        });
        gsap.to(surface, {
          opacity: spotlightSurfaceOpacity,
          duration: duration.fast,
          overwrite: "auto",
        });
      });
      const onLeave = contextSafe(() => {
        gsap.to(discs, {
          opacity: 0,
          duration: duration.base,
          overwrite: "auto",
        });
      });

      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointermove", onMove);
      card.addEventListener("pointerleave", onLeave);
      return () => {
        card.removeEventListener("pointerenter", onEnter);
        card.removeEventListener("pointermove", onMove);
        card.removeEventListener("pointerleave", onLeave);
      };
    },
    { scope },
  );
  return null;
}
