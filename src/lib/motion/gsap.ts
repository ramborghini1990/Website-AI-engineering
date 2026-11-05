import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { bezier, ease } from "@/lib/motion/tokens";

let registered = false;

/**
 * Registers GSAP plugins and our easing curves, once per page load.
 *
 * Every motion file imports `gsap`, `ScrollTrigger` and `useGSAP` from HERE
 * (never from "gsap" directly) so registration cannot be forgotten or done
 * twice (CLAUDE.md §8). It runs on import in the browser and is a no-op on the
 * server, where there is no window and nothing animates.
 */
export function registerGsap(): void {
  if (registered || typeof window === "undefined") return;
  registered = true;

  gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);

  // The CSS easing tokens as GSAP eases, so CSS and GSAP motion feel identical.
  CustomEase.create(ease.standard, bezier.standard);
  CustomEase.create(ease.out, bezier.out);
  CustomEase.create(ease.in, bezier.in);
  CustomEase.create(ease.inOut, bezier.inOut);

  // Web fonts change text metrics and therefore trigger positions: measure
  // again when they have loaded (CLAUDE.md §8).
  void document.fonts.ready.then(() => {
    ScrollTrigger.refresh();
  });
}

registerGsap();

export { gsap, ScrollTrigger, useGSAP };
