import { useTranslations } from "next-intl";

import { ContactCta } from "@/components/content/contact-cta";

/** "Not sure where to start?": the closing call to action of the services pages. */
export function ServicesCta({ id }: { id: string }) {
  const t = useTranslations("services.cta");

  return (
    <ContactCta id={id} title={t("title")} body={t("body")} label={t("cta")} />
  );
}
