"use client";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Switches language while keeping the current page. They are links (it is a
 * navigation), each named in its own language and marked with `lang` and
 * `hreflang`; the active one carries `aria-current` and is also underlined and
 * bolder, so it is not signalled by colour alone. The query string and hash
 * are not carried over (usePathname is path only).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("languageSwitcher");
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-wrap gap-1">
        {routing.locales.map((locale) => {
          const isCurrent = locale === current;
          return (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                lang={locale}
                hrefLang={locale}
                prefetch={false}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-sm px-3 text-base transition-colors duration-(--duration-fast) ease-standard",
                  isCurrent
                    ? "font-semibold text-text underline decoration-accent decoration-2 underline-offset-8"
                    : "text-text-secondary hover:text-text",
                )}
              >
                {t(`names.${locale}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
