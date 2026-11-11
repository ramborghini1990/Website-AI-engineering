import { NextIntlClientProvider, useTranslations } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";

import type { Locale } from "@/i18n/routing";

import { DemoShell } from "@/components/demos/demo-shell";
import { InstagramDemo } from "@/components/demos/instagram/instagram-demo";

/**
 * The Instagram demo as it sits on its work page: the shell (title, badge, the
 * disclosure that this is a simulation, the call to action into the inquiry
 * funnel with the service pre-selected) around the interactive island. Only the
 * demo's own messages are sent to the browser.
 */
export function InstagramSection({
  locale,
  messages,
}: {
  locale: Locale;
  /** `{ demos: { shell, instagram } }` */
  messages: AbstractIntlMessages;
}) {
  const t = useTranslations("demos.shell");

  return (
    <DemoShell
      demo="instagram-lead-agent"
      id="instagram-demo"
      title={t("title")}
      badge={t("badge")}
      disclosure={{
        title: t("disclosure.title"),
        body: t("disclosure.body"),
      }}
      noscript={t("noscript")}
      cta={{
        title: t("ctaTitle"),
        body: t("ctaBody"),
        label: t("cta"),
        href: "/contact?service=ai-agents",
      }}
    >
      <NextIntlClientProvider locale={locale} messages={messages}>
        <InstagramDemo />
      </NextIntlClientProvider>
    </DemoShell>
  );
}
