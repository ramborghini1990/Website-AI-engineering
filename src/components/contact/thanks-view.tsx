import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** The confirmation: one h1, what happens next, a way back. No details of the inquiry are shown or kept in the URL. */
export function ThanksView() {
  const t = useTranslations("contact.thanks");

  return (
    <section className="mx-auto grid w-full max-w-page gap-8 px-gutter pt-16 pb-section">
      <h1 className="max-w-4xl text-5xl text-text">{t("title")}</h1>
      <p className="max-w-prose text-lg text-text-secondary">{t("body")}</p>
      <div>
        <Button asChild variant="secondary" size="lg">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </section>
  );
}
