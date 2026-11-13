import type { Metadata } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/shell/skip-link";
import { ThemeSync } from "@/components/shell/theme-sync";
import { LazyToaster } from "@/components/ui/lazy-toaster";
import { routing } from "@/i18n/routing";
import { business } from "@/lib/business";
import { hasNoValidConsent } from "@/lib/consent/server";
import { siteUrl } from "@/lib/env";
import { LenisProvider } from "@/lib/motion/lenis-provider";
import { themeInitScript } from "@/lib/theme";

import "../globals.css";

// next/font/google downloads the files at build time and serves them from our
// own origin: no request to Google at runtime (GDPR, docs/DESIGN.md §3).
//
// `display: "optional"`, not "swap": a swap re-flows text when the web font
// arrives after the first paint. Headings use the condensed width of the
// variable font (`font-stretch`, globals.css), which the fallback cannot match,
// so a late font moved the hero headline from three lines to two and shifted
// the page by CLS 0.26 on the first visit (found in P2.2, docs/DESIGN.md §3).
// With "optional" the font is used only if it is ready almost at once (it is
// preloaded and self-hosted), otherwise this page view keeps the fallback and
// the font is cached for the next one. Never a shift.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "optional",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "latin-ext"],
  display: "optional",
});

// The known locales (pages render per request, see LocaleLayout).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export function generateMetadata(): Metadata {
  const brand = business.brand.name;
  return {
    metadataBase: siteUrl,
    applicationName: brand,
    title: { default: brand, template: `%s | ${brand}` },
  };
}

/**
 * Root layout (there is no app/layout.tsx): owns <html>, fonts, the providers
 * and the page shell: skip link, header, the single <main> landmark, footer.
 * Pages render only their own content.
 */
export default async function LocaleLayout({
  children,
}: LayoutProps<"/[locale]">) {
  // Render every page per request. The CSP nonce (src/proxy.ts) is generated
  // per request and Next stamps it on its scripts while rendering; a
  // prerendered page would carry none and an enforced CSP would block it.
  await connection();
  const locale = await getLocale();
  const messages = await getMessages();
  const toaster = await getTranslations("toaster");
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // The banner is in the HTML for a visitor who has yet to choose, so it paints
  // with the first frame instead of after hydration (it was the page's LCP).
  const consentUndecided = await hasNoValidConsent();

  return (
    // suppressHydrationWarning: the theme script below adds a class to <html>
    // before React hydrates, on purpose.
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <head>
        {/* Applies a stored theme before first paint. A constant (no user input), allowed by the CSP nonce. */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        {/* The banner's buttons need JavaScript. Without it the server-rendered banner would be an inert panel over the page, so hide it (nothing non-essential loads without JavaScript either). */}
        <noscript>
          <style
            nonce={nonce}
            dangerouslySetInnerHTML={{
              __html: "[data-consent-banner]{display:none}",
            }}
          />
        </noscript>
      </head>
      {/* min-h-dvh, not h-full: Lenis adds a `lenis` class to <html> and must not be able to change the document height (layout shift). */}
      <body className="flex min-h-dvh flex-col">
        {/* Only the namespaces that client components read are sent to the browser. */}
        <NextIntlClientProvider
          locale={locale}
          messages={{
            consent: messages.consent,
            languageSwitcher: messages.languageSwitcher,
            nav: messages.nav,
            theme: messages.theme,
          }}
        >
          {/* No TooltipProvider here: no production page uses a tooltip, and the provider loads Radix Tooltip and floating-ui on every page. Wrap the subtree that needs one. */}
          <LenisProvider>
            <ThemeSync />
            <SkipLink />
            {/* After the skip link, before the page: a keyboard user meets the cookie choice first, until it is made. */}
            <ConsentBanner initiallyUndecided={consentUndecided} />
            <SiteHeader />
            <main
              id={MAIN_CONTENT_ID}
              tabIndex={-1}
              className="flex flex-1 flex-col outline-none"
            >
              {children}
            </main>
            <SiteFooter />
          </LenisProvider>
          <LazyToaster
            // The hotkey placeholder belongs to Radix and is filled in at runtime: pass it through untouched.
            viewportLabel={toaster("viewport", { hotkey: "{hotkey}" })}
            closeLabel={toaster("close")}
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
