import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { HomeDemos } from "@/components/home/home-demos";
import { HomeFinalCta } from "@/components/home/home-final-cta";
import { HomeHero } from "@/components/home/home-hero";
import { HomeProcess } from "@/components/home/home-process";
import { HomeProof } from "@/components/home/home-proof";
import { HomeServices } from "@/components/home/home-services";
import { business } from "@/lib/business";
import { getServices, getWork } from "@/lib/content/read";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const locale = await getLocale();
  const brand = business.brand.name;
  // The layout's `title.template` only applies to child segments, not to the
  // page in the same segment, so Home sets its title as absolute.
  return pageMetadata({
    locale,
    path: "/",
    ogKey: "home",
    title: t("home.title"),
    description: t("home.description", { brand }),
    absolute: true,
  });
}

/**
 * Home (P2.2). Static-first: every section is server-rendered with its text in
 * place. The sections use the FX library (docs/MOTION.md): a hero headline that
 * animates on load with CSS only, spotlight cards, a pinned process story and a
 * mesh behind the closing call to action. Without JavaScript all of it reads
 * normally; under reduced motion nothing moves. Copy: the approved deck
 * (docs/CONTENT.md). The demos section renders only once a demo is published.
 * The <main> landmark, header and footer come from the root layout.
 */
export default async function HomePage() {
  const locale = await getLocale();

  return (
    <>
      <HomeHero />
      <HomeProof />
      <HomeServices services={getServices(locale)} />
      <HomeDemos demos={getWork(locale)} />
      <HomeProcess />
      <HomeFinalCta />
    </>
  );
}
