"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { openPreferences } from "@/lib/consent/client";

export const REOPEN_BUTTON_ID = "cookie-preferences";

/**
 * The footer's "Cookie preferences" (P4.1): always there, on every page, so
 * changing or withdrawing a choice is as easy as giving it. Without JavaScript
 * it is hidden (`@media (scripting: none)`): there is nothing to change then,
 * because nothing non-essential can load.
 */
export function CookiePreferencesButton() {
  const t = useTranslations("consent");
  return (
    <Button
      id={REOPEN_BUTTON_ID}
      type="button"
      variant="tertiary"
      className="[@media(scripting:none)]:hidden"
      onClick={openPreferences}
    >
      {t("reopen")}
    </Button>
  );
}
