import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ThanksView } from "@/components/contact/thanks-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact.thanks");
  return {
    // Child segment: the layout's `title.template` appends the brand.
    title: t("title"),
    // A confirmation is not a landing page: nothing to index.
    robots: { index: false, follow: false },
  };
}

/** The confirmation shown after an inquiry was accepted (the Server Action redirects here). */
export default function ThanksPage() {
  return <ThanksView />;
}
