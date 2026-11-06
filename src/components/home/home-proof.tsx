import { useTranslations } from "next-intl";

import { SectionHeader } from "@/components/home/section-header";
import { homeProofKeys } from "@/lib/content/site-map";

/**
 * "How I work": the four technical commitments of the approved copy deck, as a
 * ledger (index, title, one sentence). There are no figures here on purpose:
 * no client, result or number has been supplied or may be invented
 * (docs/CONTENT.md). When verifiable metrics exist, they belong in this strip.
 */
export function HomeProof() {
  const t = useTranslations("home.proof");

  return (
    <section
      aria-labelledby="home-proof"
      className="border-t border-border-subtle"
    >
      <div className="mx-auto grid w-full max-w-page gap-10 px-gutter py-section">
        <SectionHeader id="home-proof" title={t("title")} />
        <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {homeProofKeys.map((key, index) => (
            <li
              key={key}
              className="grid content-start gap-3 border-t border-border-strong pt-4"
            >
              <span
                aria-hidden="true"
                className="font-mono text-xs text-text-muted"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl text-text">{t(`items.${key}.title`)}</h3>
              <p className="text-base text-text-secondary">
                {t(`items.${key}.text`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
