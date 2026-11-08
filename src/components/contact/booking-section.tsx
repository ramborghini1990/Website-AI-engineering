import { useTranslations } from "next-intl";

import { CalEmbed } from "@/components/booking/cal-embed";
import { ConsentGate } from "@/components/consent/consent-gate";

/**
 * "Prefer to book a conversation?": the booking option on the contact page,
 * under the form and independent of it (the form works the same with or without
 * it). The calendar loads only after a click; the plain link is always there.
 */
export function BookingSection({ url }: { url: string }) {
  const t = useTranslations("contact.booking");

  return (
    <section
      aria-labelledby="contact-booking"
      className="grid max-w-3xl gap-6 border-t border-border-subtle pt-12"
    >
      <div className="grid gap-3">
        <h2 id="contact-booking" className="text-3xl text-text">
          {t("title")}
        </h2>
        <p className="text-lg text-text-secondary">{t("lead")}</p>
      </div>
      <ConsentGate
        category="booking"
        provider="Cal.com"
        title={t("gate.title")}
        body={t("gate.body")}
        loadLabel={t("gate.load")}
        fallbackHref={url}
        fallbackLabel={t("fallback")}
        newTabLabel={t("newTab")}
      >
        <CalEmbed url={url} title={t("frameTitle")} />
      </ConsentGate>
    </section>
  );
}
