import { useTranslations } from "next-intl";

import { ScrollPinnedSection } from "@/components/fx/scroll-pinned-section";
import { SectionHeader } from "@/components/home/section-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { processStepKeys } from "@/lib/content/site-map";
import { isPageAvailable } from "@/lib/navigation";

const outputKeys = ["first", "second", "third"] as const;

/**
 * Static vertical phase track from `md`: a 1 px line down the left of the
 * list (a pseudo-element of the list) and one 8 px node per step (a
 * pseudo-element of the step, so it fades with its step). Purely decorative and
 * not driven by the scroll: the pinned section does not expose the active step.
 */
const trackList =
  "md:relative md:pl-8 md:before:absolute md:before:inset-y-0 md:before:left-1 md:before:w-px md:before:-translate-x-1/2 md:before:bg-border-strong";
const trackStep =
  "md:relative md:before:absolute md:before:top-5 md:before:-left-8 md:before:size-2 md:before:rounded-full md:before:bg-border-strong";

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
  index,
}: {
  linked?: boolean;
  /** Section number for the "NN / Label" index; computed by the page. */
  index?: number;
}) {
  const t = useTranslations("home.process");
  const sections = useTranslations("home.sections");
  const process = useTranslations("process");

  return (
    <div className="border-t border-border-subtle">
      <ScrollPinnedSection
        aria-labelledby="home-process"
        className="mx-auto w-full max-w-page px-gutter py-section"
        listClassName={trackList}
        stepClassName={trackStep}
        showStepIndex={false}
        steps={processStepKeys.map((key, position) => (
          // From lg the step follows the editorial grid: text in columns 1-7,
          // the outputs in the marginal rail (8-12), which also keeps the step short
          // enough for the scene to pin on a desktop screen.
          <div key={key} className="grid gap-x-8 gap-y-3 lg:grid-cols-12">
            <div className="grid max-w-prose gap-1 lg:col-span-7">
              <span className="font-mono text-xs text-text-muted uppercase">
                {process("stepLabel")} {String(position + 1).padStart(2, "0")}
              </span>
              <h3 className="text-2xl text-text">
                {process(`steps.${key}.title`)}
              </h3>
              <p className="text-base text-text-secondary">
                {process(`steps.${key}.summary`)}
              </p>
            </div>
            <ul
              aria-label={process("outputsLabel")}
              className="grid content-start gap-1 font-mono text-xs text-text-secondary lg:col-span-5"
            >
              {outputKeys.map((output) => (
                <li key={output}>
                  {process(`steps.${key}.outputs.${output}`)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      >
        <SectionHeader
          id="home-process"
          title={t("title")}
          lead={t("lead")}
          index={
            index === undefined
              ? undefined
              : { n: index, label: sections("process") }
          }
        />
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
