import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { contactNextKeys, contactPrepareKeys } from "@/lib/content/site-map";

/**
 * /contact: the page's h1 and lead, the form (or, if the site cannot take
 * inquiries right now, a plain notice) and, beside it, what helps me answer
 * well and what happens next. All copy is the approved deck (`contact.*`).
 * `form` is passed in already built: it is a client component with its own
 * message subset (see the page).
 */
export function ContactView({
  available,
  form,
  booking = null,
}: {
  available: boolean;
  form: ReactNode;
  /** The booking option (P2.7), under the form; absent when no booking page is configured. */
  booking?: ReactNode;
}) {
  const t = useTranslations("contact");

  return (
    <section className="mx-auto grid w-full max-w-page gap-12 px-gutter pt-16 pb-section">
      <div className="grid gap-6">
        <h1 className="max-w-4xl text-5xl text-text">{t("title")}</h1>
        <p className="max-w-prose text-lg text-text-secondary">{t("lead")}</p>
        <p className="max-w-prose text-base text-text-muted">{t("informal")}</p>
      </div>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          {available ? (
            form
          ) : (
            <div
              role="status"
              className="grid max-w-prose gap-3 border-t border-border-strong pt-6"
            >
              <h2 className="text-2xl text-text">
                {t("form.unavailable.title")}
              </h2>
              <p className="text-base text-text-secondary">
                {t("form.unavailable.body")}
              </p>
            </div>
          )}
        </div>

        <aside className="grid content-start gap-10">
          <section aria-labelledby="contact-prepare" className="grid gap-4">
            <h2 id="contact-prepare" className="text-xl text-text">
              {t("prepare.title")}
            </h2>
            <ul className="grid gap-4">
              {contactPrepareKeys.map((key) => (
                <li
                  key={key}
                  className="grid gap-1 border-t border-border-strong pt-3"
                >
                  <h3 className="text-base font-medium text-text">
                    {t(`prepare.items.${key}.title`)}
                  </h3>
                  <p className="text-base text-text-secondary">
                    {t(`prepare.items.${key}.text`)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="contact-next" className="grid gap-4">
            <h2 id="contact-next" className="text-xl text-text">
              {t("next.title")}
            </h2>
            <ol className="grid gap-4">
              {contactNextKeys.map((key) => (
                <li
                  key={key}
                  className="grid gap-1 border-t border-border-strong pt-3"
                >
                  <h3 className="text-base font-medium text-text">
                    {t(`next.items.${key}.title`)}
                  </h3>
                  <p className="text-base text-text-secondary">
                    {t(`next.items.${key}.text`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      {booking}
    </section>
  );
}
