import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/env";

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

// Required for static rendering with a dynamic `[locale]` root segment.
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
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Only the namespaces that client components read are sent to the browser. */}
        <NextIntlClientProvider
          locale={locale}
          messages={{ languageSwitcher: messages.languageSwitcher }}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
