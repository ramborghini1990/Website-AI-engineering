"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { gsap } from "@/lib/motion/gsap";
import { playIntro, revealOnScroll } from "@/lib/motion/reveal";
import { ease } from "@/lib/motion/tokens";
import { useMotion } from "@/lib/motion/use-motion";

// Dev-only page (copy is English and hard-coded on purpose, like the UI gallery).
// It exercises everything that can leak or shift: an intro, scroll reveals and
// ONE pinned, scrubbed scene (the heaviest ScrollTrigger feature).

const REVEALS = [
  "Content is server-rendered in its final state.",
  "The client animates it from an offset, never the other way round.",
  "Only transform and opacity move, so nothing shifts the layout.",
  "Each reveal runs once, when it enters the viewport.",
  "Under reduced motion these blocks simply stay where they are.",
  "Leaving this page must remove every ScrollTrigger it created.",
];

export function MotionDemo() {
  const scope = useRef<HTMLDivElement>(null);

  useMotion(
    ({ reduced }) => {
      playIntro(".motion-intro", { reduced });

      for (const element of gsap.utils.toArray<HTMLElement>(".motion-reveal")) {
        revealOnScroll(element, { reduced });
      }

      // Reduced motion: no pinned or scrubbed scene; the story stays in its
      // final, fully visible state as rendered on the server.
      if (reduced) return;

      const story = gsap.timeline({
        scrollTrigger: {
          trigger: ".motion-story",
          start: "top top",
          end: "+=800",
          pin: true,
          scrub: true,
        },
      });
      story
        .fromTo(
          ".motion-story-bar",
          { scaleX: 0 },
          { scaleX: 1, ease: ease.linear, duration: 1 },
          0,
        )
        .from(".motion-story-step-2", { opacity: 0, duration: 0.2 }, 0.4)
        .from(".motion-story-step-3", { opacity: 0, duration: 0.2 }, 0.8);
    },
    { scope },
  );

  return (
    <div ref={scope}>
      <main className="mx-auto grid w-full max-w-page gap-12 px-gutter py-16">
        <header className="grid gap-4">
          <h1 className="motion-intro text-4xl text-text">Motion system</h1>
          <p className="motion-intro max-w-prose text-lg text-text-secondary">
            Development-only page for Lenis, GSAP and ScrollTrigger. It checks
            layout shift, cleanup between routes and reduced motion.
          </p>
          <div className="motion-intro flex flex-wrap gap-4">
            <Button asChild variant="secondary">
              <Link href="/_dev/ui">UI gallery</Link>
            </Button>
          </div>
        </header>

        {REVEALS.slice(0, 3).map((text) => (
          <section
            key={text}
            className="motion-reveal border-t border-border-subtle py-24"
          >
            <h2 className="text-2xl text-text">Reveal</h2>
            <p className="mt-2 max-w-prose text-base text-text-secondary">
              {text}
            </p>
          </section>
        ))}

        <section className="motion-story flex min-h-dvh flex-col justify-center gap-6 border-t border-border-subtle">
          <h2 className="text-3xl text-text">Pinned story</h2>
          <div className="h-1 bg-surface-3" aria-hidden="true">
            <div className="motion-story-bar h-full origin-left bg-accent" />
          </div>
          <p className="motion-story-step-1 max-w-prose text-lg text-text">
            Step one: the scene pins to the viewport.
          </p>
          <p className="motion-story-step-2 max-w-prose text-lg text-text">
            Step two: scrolling drives the timeline.
          </p>
          <p className="motion-story-step-3 max-w-prose text-lg text-text">
            Step three: it unpins and the page continues.
          </p>
        </section>

        {REVEALS.slice(3).map((text) => (
          <section
            key={text}
            className="motion-reveal border-t border-border-subtle py-24"
          >
            <h2 className="text-2xl text-text">Reveal</h2>
            <p className="mt-2 max-w-prose text-base text-text-secondary">
              {text}
            </p>
          </section>
        ))}
      </main>
    </div>
  );
}
