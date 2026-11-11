import { NextIntlClientProvider, useTranslations } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

import type { Locale } from "@/i18n/routing";

import { BusinessDemo } from "@/components/demos/business/business-demo";
import { DemoShell } from "@/components/demos/demo-shell";

/**
 * The back-office demo as it sits on its work page: the shell (title, badge, the
 * disclosure that this is a simulation, the call to action into the inquiry
 * funnel with the service pre-selected) around the interactive island. The
 * disclosure and the call to action are this demo's own words; the badge, the
 * title and the no-JavaScript notice are the shell's. Only the demo's own
 * messages are sent to the browser.
 */
export function BusinessSection({
  locale,
  messages,
}: {
  locale: Locale;
  /** `{ demos: { shell, business } }` */
  messages: AbstractIntlMessages;
}) {
  const shell = useTranslations("demos.shell");
  const t = useTranslations("demos.business");

  return (
    <DemoShell
      demo="business-management-app"
      id="business-demo"
      title={shell("title")}
      badge={shell("badge")}
      disclosure={{
        title: shell("disclosure.title"),
        body: t("disclosure"),
      }}
      noscript={t("noscript")}
      cta={{
        title: t("ctaTitle"),
        body: t("ctaBody"),
        label: shell("cta"),
        href: "/contact?service=web-applications",
      }}
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        <BusinessDemo />
      </NextIntlClientProvider>
    </DemoShell>
  );
}
