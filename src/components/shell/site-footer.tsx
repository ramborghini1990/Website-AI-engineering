import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { business as defaultBusiness, type Business } from "@/lib/business";
import { Link } from "@/i18n/navigation";
import { legalKeys, legalPaths } from "@/lib/legal/documents";
import { CONTACT_ANCHOR } from "@/lib/navigation";

/** A detail whose value is not known yet: a neutral line, never an invented value. */
function Pending({ label }: { label: string }) {
  return (
    <span data-status="pending" className="text-text-muted italic">
      {label}
    </span>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="font-mono text-xs text-text-muted uppercase">{term}</dt>
      <dd className="text-base text-text">{children}</dd>
    </div>
  );
}

/**
 * Footer with the owner's identity and the Italian business disclosures.
 * Every identifier comes from `src/lib/business.ts`: a value that is not set yet
 * shows "not yet available"; `reaNumber: false` (not applicable to the legal
 * form) removes that row. The contact block carries the anchor the header's
 * call to action points at.
 */
export function SiteFooter({
  business = defaultBusiness,
  year = new Date().getFullYear(),
}: {
  business?: Business;
  year?: number;
}) {
  const t = useTranslations("footer");
  const legal = useTranslations("legal");
  const pending = <Pending label={t("pending")} />;

  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="mx-auto grid w-full max-w-page gap-10 px-gutter py-12 md:grid-cols-2">
        <section
          id={CONTACT_ANCHOR}
          aria-labelledby="footer-contact"
          className="grid content-start gap-4"
        >
          <h2
            id="footer-contact"
            className="font-mono text-xs text-text-muted uppercase"
          >
            {t("contactHeading")}
          </h2>
          <p className="text-lg font-semibold text-text">
            {business.brand.name}
          </p>
          <address className="grid gap-1 text-base not-italic">
            <span className="font-mono text-xs text-text-muted uppercase">
              {t("location")}
            </span>
            <span className="text-text">
              {t("address", {
                street: business.location.street,
                municipality: business.location.municipality,
                province: business.location.province,
              })}
            </span>
          </address>
        </section>

        <section
          aria-labelledby="footer-details"
          className="grid content-start gap-4"
        >
          <h2
            id="footer-details"
            className="font-mono text-xs text-text-muted uppercase"
          >
            {t("detailsHeading")}
          </h2>
          <dl className="grid gap-4">
            <Detail term={t("owner")}>{business.owner.name}</Detail>
            <Detail term={t("vat")}>{business.vatNumber ?? pending}</Detail>
            {business.reaNumber === false ? null : (
              <Detail term={t("rea")}>{business.reaNumber ?? pending}</Detail>
            )}
            <Detail term={t("pec")}>
              {business.pec === null ? (
                pending
              ) : (
                <a
                  href={`mailto:${business.pec}`}
                  className="text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                >
                  {business.pec}
                </a>
              )}
            </Detail>
          </dl>
        </section>
      </div>

      <div className="border-t border-border-subtle">
        <div className="mx-auto grid w-full max-w-page gap-x-6 gap-y-2 px-gutter py-4">
          <nav aria-label={legal("footerNav")}>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-1">
              {legalKeys.map((key) => (
                <li key={key}>
                  {/* No prefetch: four dynamic pages on every page view for links most visitors never use. */}
                  <Link
                    href={legalPaths[key]}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center text-sm text-text-secondary underline decoration-border-strong underline-offset-4 hover:text-text"
                  >
                    {legal(`titles.${key}`)}
                  </Link>
                </li>
              ))}
              <li>
                <CookiePreferencesButton />
              </li>
            </ul>
          </nav>
          <p className="text-sm text-text-muted">
            {t("rights", { year, owner: business.owner.name })}
          </p>
        </div>
      </div>
    </footer>
  );
}
