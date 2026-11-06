import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { MainNav } from "@/components/shell/main-nav";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { business } from "@/lib/business";
import { availableNavItems, type NavItem } from "@/lib/navigation";

/**
 * The site header: wordmark, main navigation, theme, language and the primary
 * call to action, in that order in the document AND on screen (focus order
 * follows the visual order, WCAG 2.4.3).
 *
 * It is one wrapping row, not separate mobile and desktop layouts: at 360 px it
 * falls into four rows (wordmark / navigation / theme and language / call to
 * action; three rows while there were two links), from `lg` it is a single row.
 * Past five links it needs a menu (docs/DESIGN.md §9). Not sticky on purpose: a sticky bar
 * would cover the focused element while tabbing (WCAG 2.2 2.4.11) and the
 * pinned scenes of the FX library; if it becomes sticky, add
 * `scroll-padding-top` and a pin offset.
 */
export function SiteHeader({
  items = availableNavItems,
  brandName = business.brand.name,
}: {
  items?: readonly NavItem[];
  brandName?: string;
}) {
  const t = useTranslations("cta");

  return (
    <header className="border-b border-border-subtle">
      <div className="mx-auto flex w-full max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-gutter py-2 lg:flex-nowrap">
        <Link
          href="/"
          className="inline-flex min-h-11 w-full items-center rounded-sm text-lg font-semibold text-text md:mr-auto md:w-auto"
        >
          {brandName}
        </Link>
        <MainNav items={items} className="-ml-3 md:ml-0" />
        <ThemeSwitch />
        <LanguageSwitcher className="-ml-3 md:ml-0" />
        <Button asChild className="ml-auto md:ml-0">
          <Link href="/contact">{t("label")}</Link>
        </Button>
      </div>
    </header>
  );
}
