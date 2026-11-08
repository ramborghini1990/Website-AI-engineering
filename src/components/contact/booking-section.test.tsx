import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BookingSection } from "@/components/contact/booking-section";
import type { Locale } from "@/i18n/routing";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

const messages = { it: it_, en } as const;
const BOOKING_URL = "https://cal.eu/example-handle/intro";

function renderIn(locale: Locale) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <BookingSection url={BOOKING_URL} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        // jsdom has no layout
      }
      unobserve() {
        // jsdom has no layout
      }
      disconnect() {
        // jsdom has no layout
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe.each(["it", "en"] as const)("BookingSection (%s)", (locale) => {
  const copy = messages[locale].contact.booking;

  it("names the option in an h2 and says what it is", () => {
    renderIn(locale);

    expect(
      screen.getByRole("heading", { level: 2, name: copy.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: copy.title }),
    ).toBeInTheDocument();
  });

  it("starts blocked, with the disclosure and the plain link, and no frame (negative)", () => {
    const { container } = renderIn(locale);

    expect(screen.getByText(copy.gate.title)).toBeInTheDocument();
    expect(screen.getByText(copy.gate.body)).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen.getByRole("link", { name: new RegExp(copy.fallback) }),
    ).toHaveAttribute("href", BOOKING_URL);
  });

  it("names the provider and the data it receives in the disclosure, without a promise it cannot keep", () => {
    const body = copy.gate.body;

    expect(body).toContain("Cal.com");
    expect(body).toMatch(/IP/);
    expect(body).not.toMatch(/GDPR|garant|guarant|100 ?%/i);
  });

  it("after the click, embeds exactly the configured page in a titled, sandboxed frame", () => {
    const { container } = renderIn(locale);

    fireEvent.click(screen.getByRole("button", { name: copy.gate.load }));

    const frame = container.querySelector("iframe");
    expect(frame).toHaveAttribute("src", BOOKING_URL);
    expect(frame).toHaveAttribute("title", copy.frameTitle);
    expect(frame).toHaveAttribute("referrerpolicy", "strict-origin");
    expect(frame).toHaveAttribute("allow", "");
    const sandbox = frame?.getAttribute("sandbox") ?? "";
    for (const grant of ["allow-scripts", "allow-same-origin", "allow-forms"]) {
      expect(sandbox).toContain(grant);
    }
  });

  it("the frame cannot navigate our page or open modals on its own (negative)", () => {
    const { container } = renderIn(locale);
    fireEvent.click(screen.getByRole("button", { name: copy.gate.load }));

    const sandbox =
      container.querySelector("iframe")?.getAttribute("sandbox") ?? "";

    for (const forbidden of [
      "allow-top-navigation",
      "allow-modals",
      "allow-downloads",
      "allow-pointer-lock",
      "allow-presentation",
    ]) {
      expect(sandbox, forbidden).not.toContain(forbidden);
    }
  });
});
