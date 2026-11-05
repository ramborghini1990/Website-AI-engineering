import { useTranslations } from "next-intl";

/** Id of the `<main>` element in the root layout: the skip link's target. */
export const MAIN_CONTENT_ID = "main-content";

/**
 * "Skip to main content": the first focusable element of every page (WCAG 2.4.1).
 * Hidden until it receives keyboard focus, then shown over the page. A plain
 * in-page link, so it works without JavaScript.
 */
export function SkipLink() {
  const t = useTranslations("skipLink");

  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-toast) focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-sm focus:bg-accent focus:px-4 focus:text-base focus:font-medium focus:text-on-accent"
    >
      {t("label")}
    </a>
  );
}
