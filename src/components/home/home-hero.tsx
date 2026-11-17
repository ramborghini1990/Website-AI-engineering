import { useTranslations } from "next-intl";

import { Diagram } from "@/components/diagrams/diagram";
import { HairlineGrid } from "@/components/diagrams/hairline-grid";
import { MagneticButton } from "@/components/fx/magnetic-button";
import { TextReveal } from "@/components/fx/text-reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { heroDiagram } from "@/lib/diagrams/hero";

/**
 * Hero: eyebrow, the one-line offer as the page's h1, the lead and two calls to
 * action, with the agent-architecture diagram (docs/DESIGN.md §7.1) beside them
 * from `lg` (columns 8-12) and after the calls to action below it. A hairline
 * grid sits behind the section. The headline animates on load with CSS only (`TextReveal
 * when="load"`), so the text is in the server HTML and nothing waits for
 * JavaScript. The primary action goes to the contact page; the secondary one
 * scrolls to the services on this page.
 */
export function HomeHero() {
  const t = useTranslations("home.hero");

  return (
    <section className="relative">
      <HairlineGrid />
      <div className="relative mx-auto grid w-full max-w-page px-gutter pt-16 pb-section lg:grid-cols-12 lg:items-start lg:gap-x-gutter">
        <div className="lg:col-span-7">
          <p className="flex items-center gap-3 font-mono text-xs text-text-muted uppercase">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-accent"
            />
            {t("eyebrow")}
          </p>
          <TextReveal
            as="h1"
            when="load"
            text={t("headline")}
            className="mt-6 max-w-4xl text-5xl text-text"
          />
          <p className="mt-6 max-w-prose text-lg text-text-secondary">
            {t("lead")}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <MagneticButton>
              <Button asChild size="lg">
                <Link href="/contact">{t("primaryCta")}</Link>
              </Button>
            </MagneticButton>
            <Button asChild size="lg" variant="secondary">
              <a href="#services">{t("secondaryCta")}</a>
            </Button>
          </div>
        </div>
        <Diagram
          diagram={heroDiagram}
          namespace="diagrams.hero"
          className="mt-12 max-w-md lg:col-span-5 lg:col-start-8 lg:mt-0 lg:max-w-none"
        />
      </div>
    </section>
  );
}
