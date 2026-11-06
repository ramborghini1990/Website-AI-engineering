import { useTranslations } from "next-intl";

import { GradientMesh } from "@/components/fx/gradient-mesh";
import { MagneticButton } from "@/components/fx/magnetic-button";
import { SectionHeader } from "@/components/home/section-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The closing call to action over the ambient mesh (CSS only, very faint:
 * `fx-contrast.test.ts` proves the text keeps AA contrast over it). The action
 * goes to the contact page.
 */
export function HomeFinalCta() {
  const t = useTranslations("home.finalCta");

  return (
    <GradientMesh className="border-t border-border-subtle">
      <section aria-labelledby="home-final-cta">
        <div className="mx-auto grid w-full max-w-page gap-8 px-gutter py-section">
          <SectionHeader
            id="home-final-cta"
            title={t("title")}
            lead={t("body")}
          />
          <div>
            <MagneticButton>
              <Button asChild size="lg">
                <Link href="/contact">{t("cta")}</Link>
              </Button>
            </MagneticButton>
          </div>
        </div>
      </section>
    </GradientMesh>
  );
}
