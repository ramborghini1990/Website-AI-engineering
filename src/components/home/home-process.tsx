import { useTranslations } from "next-intl";

import { ScrollPinnedSection } from "@/components/fx/scroll-pinned-section";
import { SectionHeader } from "@/components/home/section-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { processStepKeys } from "@/lib/content/site-map";
import { isPageAvailable } from "@/lib/navigation";

/**
 * The four phases, as the scroll-pinned story of the FX library: the section
 * pins while scrolling reveals each step. Every step is server-rendered, in
 * order and visible: without JavaScript, under reduced motion, or on a screen
 * too short to pin it, this is a plain stacked list. Steps are text only (a
 * step that is still transparent would be focusable). The link to the full
 * method appears once `/process` exists.
 */
export function HomeProcess({
  linked = isPageAvailable("process"),
}: {
  linked?: boolean;
}) {
  const t = useTranslations("home.process");
  const steps = useTranslations("process.steps");

  return (
    <div className="border-t border-border-subtle">
      <ScrollPinnedSection
        aria-labelledby="home-process"
        className="mx-auto w-full max-w-page px-gutter py-section"
        steps={processStepKeys.map((key) => (
          <div key={key} className="grid max-w-prose gap-1">
            <h3 className="text-2xl text-text">{steps(`${key}.title`)}</h3>
            <p className="text-base text-text-secondary">
              {steps(`${key}.summary`)}
            </p>
          </div>
        ))}
      >
        <SectionHeader id="home-process" title={t("title")} lead={t("lead")} />
      </ScrollPinnedSection>
      {linked ? (
        <div className="mx-auto w-full max-w-page px-gutter pb-section">
          <Button asChild variant="secondary">
            <Link href="/process">{t("cta")}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
