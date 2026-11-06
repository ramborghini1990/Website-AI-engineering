import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";

import { ContactView } from "@/components/contact/contact-view";
import { InquiryForm } from "@/components/contact/inquiry-form";
import { getInquiryRuntime, turnstileSiteKey } from "@/lib/inquiry/runtime";
import { localeAlternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.contact");
  const locale = await getLocale();
  return {
    // Child segment: the layout's `title.template` appends the brand.
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates(locale, "/contact"),
  };
}

/**
 * /contact (P2.5): the inquiry form. Only the form's messages are sent to the
 * browser (the rest of the page is server-rendered). If a deployed site lacks a
 * required service (database, rate limiting, bot check, email), the page says
 * the form is unavailable instead of accepting an inquiry it could not keep.
 */
export default async function ContactPage() {
  const locale = await getLocale();
  const messages = await getMessages();
  const runtime = getInquiryRuntime();

  return (
    <ContactView
      available={runtime.ready}
      form={
        <NextIntlClientProvider
          locale={locale}
          messages={{ contact: { form: messages.contact.form } }}
        >
          <InquiryForm turnstileSiteKey={turnstileSiteKey()} />
        </NextIntlClientProvider>
      }
    />
  );
}
