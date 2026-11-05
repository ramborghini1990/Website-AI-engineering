import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";
import { LenisProvider } from "@/lib/motion/lenis-provider";

import "../globals.css";

// next/font/google downloads the files at build time and serves them from our
// own origin: no request to Google at runtime (GDPR, docs/DESIGN.md §3).
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// The known locales (pages render per request, see LocaleLayout).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    metadataBase: siteUrl,
    title: { default: t("siteName"), template: `%s | ${t("siteName")}` },
  };
}

/** Root layout (there is no app/layout.tsx): owns <html>, fonts and the i18n provider. */
export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  // Render every page per request. The CSP nonce (src/proxy.ts) is generated
  // per request and Next stamps it on its scripts while rendering; a
  // prerendered page would carry none and an enforced CSP would block it.
  await connection();
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      {/* min-h-dvh, not h-full: Lenis adds a `lenis` class to <html> and must not be able to change the document height (layout shift). */}
      <body className="flex min-h-dvh flex-col">
        {/* Only the namespaces that client components read are sent to the browser. */}
        <NextIntlClientProvider
          locale={locale}
          messages={{ languageSwitcher: messages.languageSwitcher }}
        >
          <LenisProvider>{children}</LenisProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
