import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

import { routing, type Locale } from "@/i18n/routing";
import type { Messages } from "@/i18n/messages";

// Static imports so every locale is known to the bundler, and both files are
// checked against the same `Messages` type.
const loaders = {
  it: () => import("../../messages/it.json"),
  en: () => import("../../messages/en.json"),
} satisfies Record<Locale, () => Promise<{ default: Messages }>>;

export default getRequestConfig(async ({ locale }) => {
  // The locale comes from the `[locale]` root parameter (Next 16.3+);
  // an unknown value is rejected at runtime.
  if (!locale) {
    const fromUrl = await rootParams.locale();
    if (!hasLocale(routing.locales, fromUrl)) notFound();
    locale = fromUrl;
  }

  return {
    locale,
    messages: (await loaders[locale]()).default,
  };
});
