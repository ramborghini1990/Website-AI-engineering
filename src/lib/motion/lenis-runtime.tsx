"use client";

import Lenis from "lenis";
import { useEffect } from "react";

import { usePathname } from "@/i18n/navigation";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

/**
 * The smooth-scroll engine. Loaded lazily by LenisProvider (it pulls in GSAP
 * and Lenis) and never mounted under reduced motion.
 *
 * ONE animation loop: Lenis has no loop of its own (`autoRaf: false`); its
 * `raf` is called from `gsap.ticker`, and ScrollTrigger is updated on every
 * Lenis scroll (the official Lenis + ScrollTrigger integration). Never create
 * a second Lenis instance or a second `requestAnimationFrame` loop.
 */
export default function LenisRuntime() {
  const pathname = usePathname();

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: true,
      // Touch scrolling stays native: better on phones and for accessibility.
      syncTouch: false,
      anchors: false,
    });

    lenis.on("scroll", () => {
      ScrollTrigger.update();
    });
    const tick = (time: number) => {
      lenis.raf(time * 1000); // GSAP time is in seconds, Lenis wants ms
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0); // lag smoothing would delay scroll-linked animation

    // Radix Dialog/Sheet/Select lock page scroll with `data-scroll-locked`
    // on <body>. Lenis scrolls with window.scrollTo, which that lock does not
    // stop, so pause Lenis while it is set.
    const syncWithScrollLock = () => {
      if (document.body.hasAttribute("data-scroll-locked")) lenis.stop();
      else lenis.start();
    };
    syncWithScrollLock();
    const observer = new MutationObserver(syncWithScrollLock);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-scroll-locked"],
    });

    return () => {
      observer.disconnect();
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33); // GSAP's defaults
      lenis.destroy();
    };
  }, []);

  // A new page changes the layout: measure every ScrollTrigger again after the
  // new route has mounted and created its own (children's effects ran first).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
