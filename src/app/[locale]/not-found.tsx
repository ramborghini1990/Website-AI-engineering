import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Localized 404 (rendered for notFound() and, via the catch-all route, for unknown paths). P1.8 refines it. */
export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-6 px-gutter py-16">
      <h1 className="text-4xl text-text">{t("title")}</h1>
      <p className="max-w-prose text-lg text-text-secondary">{t("body")}</p>
      <div>
        <Button asChild>
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
      <LanguageSwitcher className="-ml-3" />
    </main>
  );
}
