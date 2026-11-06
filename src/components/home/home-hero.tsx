import { useTranslations } from "next-intl";

import { MagneticButton } from "@/components/fx/magnetic-button";
import { TextReveal } from "@/components/fx/text-reveal";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Hero: eyebrow, the one-line offer as the page's h1, the lead and two calls to
 * action. The headline animates on load with CSS only (`TextReveal
 * when="load"`), so the text is in the server HTML and nothing waits for
 * JavaScript. The primary action goes to the contact page; the secondary one
 * scrolls to the services on this page.
 */
export function HomeHero() {
  const t = useTranslations("home.hero");

  return (
    <section className="mx-auto w-full max-w-page px-gutter pt-16 pb-section">
      <p className="flex items-center gap-3 font-mono text-xs text-text-muted uppercase">
        <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
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
    </section>
  );
}
