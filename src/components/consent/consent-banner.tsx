"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { REOPEN_BUTTON_ID } from "@/components/consent/cookie-preferences-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import {
  acceptEverything,
  allows,
  closePanel,
  rejectEverything,
  saveChoices,
  useConsent,
} from "@/lib/consent/client";
import { COOKIE_POLICY_PATH } from "@/lib/consent/registry";

/**
 * The cookie banner (P4.1), built to the Garante's 2021 guidelines:
 * - "Reject all" and "Accept all" are the same component with the same variant,
 *   size and weight: neither is nudged. The "X" rejects, and the text says so.
 * - Nothing is ticked in advance, scrolling or browsing on never counts as
 *   consent, and there is no scroll or click-elsewhere listener at all.
 * - The banner shows only while there is no valid decision (none, older than 6
 *   months, or about another wording version); opened again from the footer it
 *   starts on the preferences, showing what is currently allowed, so withdrawing
 *   is as easy as giving.
 *
 * It is a non-modal region fixed to the bottom: the page stays readable and
 * usable behind it, focus is not trapped. For a visitor with no valid decision
 * the server renders it in the HTML (it paints with the first frame); with
 * JavaScript off the layout hides it with a <noscript> rule, since its buttons
 * need JavaScript (nothing non-essential can load without JavaScript anyway).
 */
export function ConsentBanner({
  initiallyUndecided = false,
}: {
  /** The server saw no valid decision: render the banner in the HTML, not after hydration. */
  initiallyUndecided?: boolean;
}) {
  const t = useTranslations("consent");
  const consent = useConsent(initiallyUndecided);
  const prefsId = useId();
  const titleId = useId();
  const [customizing, setCustomizing] = useState(false);
  // The visitor's tick on the booking category; `null` = untouched, so the box
  // shows what is allowed now (nothing, the first time: never pre-ticked).
  const [bookingDraft, setBookingDraft] = useState<boolean | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const section = useRef<HTMLElement>(null);

  const reopened = consent.status === "decided" && consent.panelOpen;
  const visible = consent.status === "undecided" || reopened;
  const showPrefs = customizing || reopened;
  const booking = bookingDraft ?? allows(consent, "booking");
  const receiptId = consent.status === "decided" ? consent.decision.id : null;

  // Opened from the footer: move focus to the notice, so a keyboard or
  // screen-reader user lands on it. The first banner never takes focus.
  useEffect(() => {
    if (reopened) section.current?.focus();
  }, [reopened]);

  // While the banner is on screen, tell the toast viewport how tall it is, so a
  // toast is shown above the banner and never over its buttons (two targets on
  // top of each other fail WCAG 2.2 target size). Cleared when the banner goes.
  useEffect(() => {
    const element = section.current;
    if (!visible || element === null) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty(
        "--consent-offset",
        `${String(element.offsetHeight)}px`,
      );
    };
    publish();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(publish);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--consent-offset");
    };
  }, [visible]);

  /** Runs a decision, then resets the form and says what happened. */
  const finish = (decide: () => void, announce: boolean) => {
    const fromFooter = reopened;
    decide();
    setCustomizing(false);
    setBookingDraft(null);
    setAnnouncement(announce ? t("saved") : "");
    // The banner is about to go: hand focus back to the link that opened it.
    if (fromFooter) document.getElementById(REOPEN_BUTTON_ID)?.focus();
  };

  return (
    <>
      {/* Always mounted, so the announcement is read after the banner has gone. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {visible ? (
        <section
          ref={section}
          aria-labelledby={titleId}
          tabIndex={-1}
          data-consent-banner={reopened ? "reopened" : "first"}
          className="fixed inset-x-0 bottom-0 z-(--z-popover) max-h-dvh overflow-y-auto border-t border-border-strong bg-surface-1 shadow-modal outline-none"
        >
          <div className="mx-auto grid w-full max-w-page gap-4 px-gutter py-6">
            <div className="flex items-start justify-between gap-4">
              <p id={titleId} className="text-lg font-semibold text-text">
                {t("title")}
              </p>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={reopened ? t("closeKeep") : t("close")}
                data-consent-action={reopened ? "dismiss" : "close"}
                onClick={() => {
                  finish(
                    reopened
                      ? closePanel
                      : () => {
                          rejectEverything("close");
                        },
                    !reopened,
                  );
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <p className="max-w-prose text-base text-text-secondary">
              {t("body")}{" "}
              {reopened ? null : (
                <span data-consent-hint>{t("closeHint")}</span>
              )}
            </p>

            {showPrefs ? (
              <fieldset
                id={prefsId}
                className="grid gap-4 border border-border-subtle bg-surface-2 p-4"
              >
                <legend className="px-2 font-mono text-xs text-text-muted uppercase">
                  {t("preferencesTitle")}
                </legend>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`${prefsId}-necessary`}
                    checked
                    disabled
                    aria-describedby={`${prefsId}-necessary-d`}
                  />
                  <div className="grid gap-1">
                    <Label htmlFor={`${prefsId}-necessary`}>
                      {t("categories.necessary.label")}
                    </Label>
                    <p
                      id={`${prefsId}-necessary-d`}
                      className="max-w-prose text-sm text-text-secondary"
                    >
                      {t("categories.necessary.description")}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`${prefsId}-booking`}
                    checked={booking}
                    onCheckedChange={(value) => {
                      setBookingDraft(value === true);
                    }}
                    aria-describedby={`${prefsId}-booking-d`}
                  />
                  <div className="grid gap-1">
                    <Label htmlFor={`${prefsId}-booking`}>
                      {t("categories.booking.label")}
                    </Label>
                    <p
                      id={`${prefsId}-booking-d`}
                      className="max-w-prose text-sm text-text-secondary"
                    >
                      {t("categories.booking.description")}
                    </p>
                  </div>
                </div>
                {receiptId === null ? null : (
                  <p className="font-mono text-xs break-all text-text-muted">
                    {t("receipt", { id: receiptId })}
                  </p>
                )}
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    data-consent-action="save"
                    onClick={() => {
                      finish(() => {
                        saveChoices({ booking });
                      }, true);
                    }}
                  >
                    {t("save")}
                  </Button>
                </div>
              </fieldset>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* In the row of actions, not in the paragraph and not on a row of its own: a longer paragraph became the page's largest contentful paint instead of the hero (home.spec), and a taller banner covered content the FX spec points at. No prefetch: the banner is on screen at every first visit, and the policy is a dynamic page (a server render per visitor, competing with the receipt). */}
              <Link
                href={COOKIE_POLICY_PATH}
                prefetch={false}
                className="inline-flex min-h-11 items-center text-base text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
              >
                {t("policyLink")}
              </Link>
              {/* Same component, same variant, same size: equal prominence. */}
              <Button
                type="button"
                data-consent-action="reject_all"
                onClick={() => {
                  finish(() => {
                    rejectEverything("reject_all");
                  }, true);
                }}
              >
                {t("rejectAll")}
              </Button>
              <Button
                type="button"
                data-consent-action="accept_all"
                onClick={() => {
                  finish(acceptEverything, true);
                }}
              >
                {t("acceptAll")}
              </Button>
              {showPrefs ? null : (
                <Button
                  type="button"
                  variant="tertiary"
                  aria-expanded={false}
                  aria-controls={prefsId}
                  data-consent-action="customize"
                  onClick={() => {
                    setCustomizing(true);
                  }}
                >
                  {t("customize")}
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
