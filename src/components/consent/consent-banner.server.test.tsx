import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { ConsentGate } from "@/components/consent/consent-gate";

import it_ from "../../../messages/it.json";

/**
 * What the SERVER sends (P4.7). A visitor with no valid decision gets the
 * banner in the HTML, so it paints with the first frame. Nothing else changes:
 * a gate still renders blocked until the browser has read the cookie.
 */
function html(node: React.ReactNode): string {
  return renderToString(
    <NextIntlClientProvider
      locale="it"
      messages={{ consent: it_.consent }}
      timeZone="Europe/Rome"
    >
      {node}
    </NextIntlClientProvider>,
  );
}

describe("the banner in the server-rendered HTML", () => {
  it("is present when the server saw no valid decision", () => {
    const out = html(<ConsentBanner initiallyUndecided />);
    expect(out).toContain("data-consent-banner");
    expect(out).toContain('data-consent-action="reject_all"');
    expect(out).toContain('data-consent-action="accept_all"');
  });

  it("carries the notice text, so it can be the first contentful paint", () => {
    const out = html(<ConsentBanner initiallyUndecided />);
    expect(out).toContain(it_.consent.title);
  });

  it("is absent by default and for a visitor who has decided (negative)", () => {
    expect(html(<ConsentBanner />)).not.toContain("data-consent-banner");
    expect(html(<ConsentBanner initiallyUndecided={false} />)).not.toContain(
      "data-consent-banner",
    );
  });

  it("starts on the first-visit variant, never on the reopened preferences", () => {
    const out = html(<ConsentBanner initiallyUndecided />);
    expect(out).toContain('data-consent-banner="first"');
    expect(out).not.toContain("<fieldset");
  });

  it("does not unblock anything: a gate renders blocked on the server (negative)", () => {
    const out = html(
      <>
        <ConsentBanner initiallyUndecided />
        <ConsentGate
          category="booking"
          provider="Cal.com"
          title="Prenotazione"
          body="Testo"
          loadLabel="Carica"
          fallbackHref="https://cal.eu/x"
          fallbackLabel="Apri"
          newTabLabel="(nuova scheda)"
        >
          <iframe title="third-party" src="https://cal.eu/x" />
        </ConsentGate>
      </>,
    );
    // The plain link to the provider is allowed; the embed itself is not.
    expect(out).not.toContain("<iframe");
  });
});
