import type { Metadata } from "next";

import { GradientMesh } from "@/components/fx/gradient-mesh";
import { MagneticButton } from "@/components/fx/magnetic-button";
import { Marquee } from "@/components/fx/marquee";
import { ScrollPinnedSection } from "@/components/fx/scroll-pinned-section";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { TextReveal } from "@/components/fx/text-reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "FX library (dev)",
  robots: { index: false, follow: false },
};

// Dev-only showcase (English, hard-coded on purpose, like the UI gallery).
// Server component: the server-only FX (Marquee, GradientMesh) render here
// without any client JavaScript; the others hydrate as small client leaves.

const STACK = [
  "Next.js",
  "React",
  "TypeScript",
  "Postgres",
  "Drizzle",
  "Zod",
  "Claude API",
  "MCP",
  "Vitest",
  "Playwright",
];

const CARDS = [
  {
    title: "AI agents",
    text: "Tool-using agents with guardrails, evaluation and a human in the loop.",
  },
  {
    title: "Workflow automation",
    text: "Document and process pipelines with retries and an audit trail.",
  },
  {
    title: "Web applications",
    text: "Production Next.js apps: typed, tested, accessible, fast on mobile.",
  },
];

function Block({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-6 border-t border-border-subtle py-16"
    >
      <div className="grid gap-2">
        <h2 id={id} className="text-2xl text-text">
          {title}
        </h2>
        <p className="max-w-prose text-base text-text-secondary">{note}</p>
      </div>
      {children}
    </section>
  );
}

export default function FxPage() {
  return (
    <div className="mx-auto w-full max-w-page px-gutter pb-section">
      <GradientMesh className="-mx-gutter px-gutter py-16">
        <header className="grid gap-4">
          <h1 className="text-4xl text-text">FX library</h1>
          <p className="max-w-prose text-lg text-text-secondary">
            Development-only showcase. Every effect has a static fallback (no
            JavaScript, reduced motion) and none is loaded by pages that do not
            use it.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild variant="secondary">
              <Link href="/_dev/ui">UI gallery</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/_dev/motion">Motion test page</Link>
            </Button>
          </div>
        </header>
      </GradientMesh>

      <Block
        id="fx-marquee"
        title="Marquee"
        note="Technical ticker. Pauses on hover and with the switch; with reduced motion it is a wrapped, static list."
      >
        <Marquee
          items={STACK}
          label="Technologies we build with"
          pauseLabel="Pause the ticker"
        />
      </Block>

      <Block
        id="fx-magnetic"
        title="Magnetic button"
        note="Leans toward a nearby mouse. Pointer-only and decorative; keyboard and touch are untouched."
      >
        <div className="flex flex-wrap gap-8">
          <MagneticButton>
            <Button>Start a project</Button>
          </MagneticButton>
          <MagneticButton>
            <Button variant="secondary">See the work</Button>
          </MagneticButton>
        </div>
      </Block>

      <Block
        id="fx-text-reveal"
        title="Text reveal"
        note="Words rise in once when the headline scrolls into view; a headline already on screen stays still."
      >
        <TextReveal
          as="h3"
          text="Agents that do the work, engineered to be trusted."
          className="max-w-prose text-4xl text-text"
        />
        <TextReveal
          as="h3"
          text="Automation you can audit, from the first run to the thousandth."
          className="max-w-prose text-4xl text-text"
        />
      </Block>

      <Block
        id="fx-spotlight"
        title="Spotlight card"
        note="A glow follows the pointer along the border and the surface."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {CARDS.map((card) => (
            <SpotlightCard key={card.title}>
              <h3 className="text-xl text-text">{card.title}</h3>
              <p className="mt-2 text-base text-text-secondary">{card.text}</p>
            </SpotlightCard>
          ))}
        </div>
      </Block>

      <ScrollPinnedSection
        className="border-t border-border-subtle"
        steps={[
          <p key="1" className="max-w-prose text-lg text-text">
            The section pins to the viewport and the first step is already
            there.
          </p>,
          <p key="2" className="max-w-prose text-lg text-text">
            Scrolling reveals the second step and fills the progress bar.
          </p>,
          <p key="3" className="max-w-prose text-lg text-text">
            The third step arrives, then the section lets go and the page
            continues.
          </p>,
        ]}
      >
        <h2 className="text-3xl text-text">Scroll-pinned section</h2>
      </ScrollPinnedSection>

      <Block
        id="fx-end"
        title="End of page"
        note="Space below the pinned section, so unpinning is visible."
      >
        <div className="h-48" aria-hidden="true" />
      </Block>
    </div>
  );
}
