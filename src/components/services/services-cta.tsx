import { useTranslations } from "next-intl";

import { SectionHeader } from "@/components/home/section-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { contactHref, resolveInternalPath } from "@/lib/navigation";

/**
 * "Not sure where to start?": the closing call to action of the services
 * pages. It goes to the contact block until `/contact` exists, then to the page
 * (`resolveInternalPath` switches by itself when the page ships).
 */
export function ServicesCta({ id }: { id: string }) {
  const t = useTranslations("services.cta");
  const target = resolveInternalPath("/contact");

  return (
    <section aria-labelledby={id} className="border-t border-border-subtle">
      <div className="mx-auto grid w-full max-w-page gap-8 px-gutter py-section">
        <SectionHeader id={id} title={t("title")} lead={t("body")} />
        <div>
          <Button asChild size="lg">
            {target.kind === "page" ? (
              <Link href={target.href}>{t("cta")}</Link>
            ) : (
              <a href={target.kind === "anchor" ? target.href : contactHref}>
                {t("cta")}
              </a>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
