import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { LanguageSwitcher } from "@/components/language-switcher";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const locale = await getLocale();
  return {
    // The layout's `title.template` only applies to child segments, not to
    // the page in the same segment, so the brand suffix is added here.
    title: { absolute: `${t("home.title")} | ${t("siteName")}` },
    description: t("home.description"),
    alternates: localeAlternates(locale, "/"),
  };
}

/** Placeholder home: the real page is P2.2, the copy deck is P2.1. */
export default function HomePage() {
  const t = useTranslations("home");

  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-6 px-gutter py-16">
      <h1 className="text-5xl text-text">{t("title")}</h1>
      <p className="max-w-prose text-lg text-text-secondary">{t("status")}</p>
      {/* -ml-3 cancels the link padding so the text aligns with the heading; the hit area stays 44px */}
      <LanguageSwitcher className="-ml-3" />
    </main>
  );
}
