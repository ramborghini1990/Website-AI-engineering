import {
  FlaskConical,
  Hand,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { SectionHeader } from "@/components/home/section-header";
import { homeProofKeys } from "@/lib/content/site-map";

/** One icon per commitment, mapped by key so a new key cannot go without one. */
const proofIcons: Record<(typeof homeProofKeys)[number], LucideIcon> = {
  owner: UserRound,
  quality: FlaskConical,
  human: Hand,
  privacy: ShieldCheck,
};

/**
 * "How I work": the four technical commitments of the approved copy deck, as a
 * ledger (index, icon, title, one sentence). There are no figures here on
 * purpose: no client, result or number has been supplied or may be invented
 * (docs/CONTENT.md). When verifiable metrics exist, they belong in this strip.
 * The first item's hairline carries the one accent element of the section.
 */
export function HomeProof({ index }: { index?: number } = {}) {
  const t = useTranslations("home.proof");
  const sections = useTranslations("home.sections");

  return (
    <section
      aria-labelledby="home-proof"
      className="border-t border-border-subtle"
    >
      <div className="mx-auto grid w-full max-w-page gap-10 px-gutter py-section">
        <SectionHeader
          id="home-proof"
          title={t("title")}
          index={
            index === undefined
              ? undefined
              : { n: index, label: sections("proof") }
          }
        />
        <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
          {homeProofKeys.map((key, position) => {
            const Icon = proofIcons[key];
            return (
              <li
                key={key}
                className="relative grid content-start gap-3 border-t border-border-strong pt-4"
              >
                {position === 0 ? (
                  <span
                    aria-hidden="true"
                    data-proof-accent
                    className="absolute -top-px left-0 h-0.5 w-8 bg-accent"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs text-text-muted"
                  >
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  <Icon
                    aria-hidden="true"
                    size={24}
                    strokeWidth={1.5}
                    className="text-text-secondary"
                  />
                </div>
                <h3 className="text-xl text-text">{t(`items.${key}.title`)}</h3>
                <p className="text-base text-text-secondary">
                  {t(`items.${key}.text`)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
