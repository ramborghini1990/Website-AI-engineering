import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

// A nested not-found.tsx cannot set <title> (only the root one can), so the
// title of the 404 comes from this route, which is what renders for unknown
// paths. Same-segment rule as in ../page.tsx: the brand suffix is added here.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: { absolute: `${t("notFound.title")} | ${t("siteName")}` } };
}

// Unknown paths under a valid locale land here so that the localized
// not-found page renders (next-intl: a not-found.tsx only runs for notFound()).
export default function CatchAllPage() {
  notFound();
}
