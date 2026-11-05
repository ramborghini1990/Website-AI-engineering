"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * Error boundary for everything under the layout (the "500" page). It shows
 * nothing about the error itself (no message, no digest): details belong in the
 * server logs, never on the page (CLAUDE.md §10). `reset` re-renders the
 * segment. A failure in the root layout itself needs `global-error.tsx`
 * (follow-up in PROJECT_STATE).
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations("error");

  return (
    <div className="mx-auto flex w-full max-w-page flex-1 flex-col justify-center gap-6 px-gutter py-16">
      <h1 className="text-4xl text-text">{t("title")}</h1>
      <p className="max-w-prose text-lg text-text-secondary">{t("body")}</p>
      <div className="flex flex-wrap gap-4">
        <Button onClick={reset}>{t("retry")}</Button>
        <Button asChild variant="secondary">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
