import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsentBanner } from "@/components/consent/consent-banner";
import { ConsentGate } from "@/components/consent/consent-gate";
import { CookiePreferencesButton } from "@/components/consent/cookie-preferences-button";
import { resetConsentForTests } from "@/lib/consent/client";
import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";
import { CONSENT_COOKIE, parseDecision } from "@/lib/consent/state";

import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

const ID = "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b";
const DAY = 24 * 60 * 60 * 1000;

const fetchMock = vi.fn();

function page(locale: "it" | "en" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "it" ? it_ : en}
    >
      <ConsentBanner />
      <ConsentGate
        category="booking"
        provider="Cal.com"
        title="Calendar"
        body="Nothing is loaded yet."
        loadLabel="Load the calendar"
        fallbackHref="https://cal.eu/example"
        fallbackLabel="Open the booking page"
        newTabLabel="(opens in a new tab)"
      >
        <iframe src="https://third-party.example/embed" title="the embed" />
      </ConsentGate>
      <footer>
        <CookiePreferencesButton />
      </footer>
    </NextIntlClientProvider>,
  );
}

const cookieValue = () =>
  document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);

const stored = () => parseDecision(cookieValue(), Date.now());
const banner = () => document.querySelector("[data-consent-banner]");
const action = (name: string) =>
  document.querySelector<HTMLButtonElement>(`[data-consent-action='${name}']`);
const receiptBodies = (): Array<Record<string, unknown>> =>
  fetchMock.mock.calls.map(
    (call) =>
      JSON.parse((call[1] as { body: string }).body) as Record<string, unknown>,
  );

/** Lets the receipt promise settle and the store re-render. */
const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

beforeEach(() => {
  resetConsentForTests();
  document.cookie = `${CONSENT_COOKIE}=; Max-Age=0; Path=/`;
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ id: ID }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the first banner", () => {
  it("shows with a title, the short notice, and what closing it means", () => {
    page();

    const region = screen.getByRole("region", {
      name: "Cookies and third-party content",
    });
    expect(banner()).toHaveAttribute("data-consent-banner", "first");
    expect(within(region).getByText(/only uses technical tools/)).toBeVisible();
    expect(
      within(region).getByText(
        /Closing this notice with the X counts as rejecting/,
      ),
    ).toBeInTheDocument();
  });

  it("is in the visitor's language", () => {
    page("it");

    expect(
      screen.getByRole("button", { name: "Rifiuta tutti" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Accetta tutti" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Personalizza" }),
    ).toBeInTheDocument();
  });

  it("does nothing before a choice: no cookie, no request, the embed stays blocked", () => {
    const { container } = page();

    expect(cookieValue()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("gives Reject all and Accept all the same weight: same element, variant, size and classes", () => {
    page();

    const reject = action("reject_all");
    const accept = action("accept_all");
    expect(reject?.tagName).toBe(accept?.tagName);
    expect(reject?.className).toBe(accept?.className);
    expect(reject?.className).toContain("min-h-11");
    // the third choice is visibly quieter, never louder
    expect(action("customize")?.className).not.toBe(accept?.className);
  });

  it("every control meets the 44px hit target", () => {
    page();

    for (const name of ["reject_all", "accept_all", "customize", "close"]) {
      const className = action(name)?.className ?? "";
      expect(className, name).toMatch(/min-h-11|size-11/);
    }
  });

  it("does not take focus on its own (non-modal), and traps none", () => {
    page();

    expect(document.activeElement).toBe(document.body);
    expect(banner()).not.toHaveAttribute("aria-modal");
    expect(banner()?.getAttribute("role")).not.toBe("dialog");
  });

  it("links to the cookie policy only when that page exists (P4.2), never to a dead end", () => {
    page();

    expect(screen.queryByRole("link", { name: /cookie policy/i })).toBeNull();
  });
});

describe("making room for toasts", () => {
  const offset = () =>
    document.documentElement.style.getPropertyValue("--consent-offset");

  it("publishes its height while it is on screen and clears it when it goes", async () => {
    page();
    expect(offset()).toMatch(/^\d+px$/);

    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await settle();

    expect(banner()).toBeNull();
    expect(offset()).toBe("");
  });

  it("publishes nothing when there is no banner (a stored choice)", () => {
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
      JSON.stringify({
        v: CONSENT_POLICY_VERSION,
        t: Date.now() - DAY,
        c: [0],
      }),
    )}; Path=/`;
    page();

    expect(banner()).toBeNull();
    expect(offset()).toBe("");
  });
});

describe("no consent by scrolling, browsing or clicking elsewhere (negative)", () => {
  it("scroll, wheel, key, pointer and click on the page do not decide anything", () => {
    page();

    for (const target of [window, document, document.body]) {
      fireEvent.scroll(target);
      fireEvent.wheel(target);
      fireEvent.keyDown(target, { key: "ArrowDown" });
      fireEvent.pointerDown(target);
      fireEvent.click(target);
    }

    expect(cookieValue()).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(banner()).not.toBeNull();
  });

  it("the banner registers no scroll or global click listener", () => {
    const add = vi.spyOn(window, "addEventListener");
    const addDoc = vi.spyOn(document, "addEventListener");

    page();

    const names = [...add.mock.calls, ...addDoc.mock.calls].map(
      (call) => call[0],
    );
    expect(names).not.toContain("scroll");
    expect(names).not.toContain("click");
    expect(names).not.toContain("wheel");
    add.mockRestore();
    addDoc.mockRestore();
  });

  it("escape does not decide for the visitor", () => {
    page();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(cookieValue()).toBeUndefined();
    expect(banner()).not.toBeNull();
  });
});

describe("accept, reject and close", () => {
  it("Accept all: stores yes, loads the embed at once, sends a receipt and keeps its code", async () => {
    const { container } = page();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();

    expect(banner()).toBeNull();
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(stored()?.choices).toEqual({ booking: true });
    expect(stored()?.version).toBe(CONSENT_POLICY_VERSION);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(receiptBodies()[0]).toEqual({
      policyVersion: CONSENT_POLICY_VERSION,
      method: "accept_all",
      choices: { booking: true },
    });
    await waitFor(() => {
      expect(stored()?.id).toBe(ID);
    });
  });

  it("Reject all: stores no, the embed stays blocked", async () => {
    const { container } = page();

    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await settle();

    expect(banner()).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(stored()?.choices).toEqual({ booking: false });
    expect(receiptBodies()[0]).toMatchObject({
      method: "reject_all",
      choices: { booking: false },
    });
  });

  it("the X rejects, and is recorded as the X (not as a deliberate reject)", async () => {
    const { container } = page();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Close and reject non-essential cookies",
      }),
    );
    await settle();

    expect(banner()).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(stored()?.choices).toEqual({ booking: false });
    expect(receiptBodies()[0]).toMatchObject({
      method: "close",
      choices: { booking: false },
    });
  });

  it("the receipt request is same-origin, carries no credentials, and holds only the three facts", async () => {
    page();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/consent");
    expect(init.credentials).toBe("omit");
    expect(Object.keys(receiptBodies()[0]).sort()).toEqual([
      "choices",
      "method",
      "policyVersion",
    ]);
  });

  it("a failing receipt never undoes or blocks the choice (negative)", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    const { container } = page();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();

    expect(banner()).toBeNull();
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(stored()?.choices).toEqual({ booking: true });
    expect(stored()?.id).toBeNull();
  });

  it("a server answer that is not a receipt code is not stored (negative)", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ id: "<b>x</b>" }))),
    );
    page();

    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();

    expect(stored()?.id).toBeNull();
  });
});

describe("customise", () => {
  it("opens the preferences with nothing ticked in advance and necessary on and locked", () => {
    page();

    fireEvent.click(screen.getByRole("button", { name: "Customise" }));

    const group = screen.getByRole("group", { name: "Your preferences" });
    const necessary = within(group).getByRole("checkbox", {
      name: "Necessary",
    });
    const booking = within(group).getByRole("checkbox", {
      name: "Booking calendar",
    });
    expect(necessary).toBeChecked();
    expect(necessary).toBeDisabled();
    expect(booking).not.toBeChecked();
    expect(booking).toBeEnabled();
    expect(booking).toHaveAccessibleDescription(/Cal\.com receives your IP/);
  });

  it("Save with nothing ticked records a custom choice of no", async () => {
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Customise" }));

    fireEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    await settle();

    expect(stored()?.choices).toEqual({ booking: false });
    expect(receiptBodies()[0]).toMatchObject({ method: "custom" });
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("Save with the box ticked records yes and loads the embed", async () => {
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Customise" }));

    fireEvent.click(screen.getByRole("checkbox", { name: "Booking calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    await settle();

    expect(stored()?.choices).toEqual({ booking: true });
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("Reject all and Accept all are still there on the preferences, equal", () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Customise" }));

    expect(action("reject_all")?.className).toBe(
      action("accept_all")?.className,
    );
  });
});

describe("a decision that lasts, and when it stops", () => {
  const visit = (cookie?: string) => {
    cleanup();
    resetConsentForTests();
    if (cookie !== undefined) {
      document.cookie = `${CONSENT_COOKIE}=${cookie}; Path=/`;
    }
    return page();
  };
  const encode = (over: Record<string, unknown> = {}) =>
    encodeURIComponent(
      JSON.stringify({
        v: CONSENT_POLICY_VERSION,
        t: Date.now() - 10 * DAY,
        c: [0],
        ...over,
      }),
    );

  it("a stored reject persists: the next visit shows no banner and the embed stays blocked", async () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await settle();

    const { container } = visit(cookieValue());

    expect(banner()).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Load the calendar" }),
    ).toBeEnabled();
  });

  it("a stored yes persists: the next visit loads the embed with no click and no focus theft", async () => {
    page();
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();

    const { container } = visit(cookieValue());

    expect(banner()).toBeNull();
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("asks again after 6 months, when the wording changed, or when the cookie is unreadable", () => {
    for (const cookie of [
      encode({ t: Date.now() - 183 * DAY }),
      encode({ v: "2025-01-v0" }),
      "garbage",
    ]) {
      visit(cookie);
      expect(banner(), cookie).not.toBeNull();
    }
  });

  it("does not ask again within 6 months", () => {
    visit(encode({ t: Date.now() - 170 * DAY }));

    expect(banner()).toBeNull();
  });
});

describe("withdrawing is as easy as giving", () => {
  async function accepted() {
    const view = page();
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    await settle();
    return view;
  }

  it("the footer link reopens the preferences, showing what is allowed now", async () => {
    await accepted();

    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));

    expect(banner()).toHaveAttribute("data-consent-banner", "reopened");
    expect(
      screen.getByRole("checkbox", { name: "Booking calendar" }),
    ).toBeChecked();
    expect(banner()).toHaveFocus();
    // the receipt code is shown so the visitor can quote it
    expect(screen.getByText(`Your choice code: ${ID}`)).toBeInTheDocument();
  });

  it("one untick and one click withdraw: the embed is unloaded, the cookie says no, a new receipt is sent", async () => {
    const { container } = await accepted();
    expect(container.querySelector("iframe")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Booking calendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Save my choices" }));
    await settle();

    expect(container.querySelector("iframe")).toBeNull();
    expect(stored()?.choices).toEqual({ booking: false });
    expect(receiptBodies().at(-1)).toMatchObject({
      method: "custom",
      choices: { booking: false },
    });
    expect(banner()).toBeNull();
  });

  it("Reject all from the reopened panel withdraws in one click", async () => {
    const { container } = await accepted();

    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await settle();

    expect(container.querySelector("iframe")).toBeNull();
    expect(stored()?.choices).toEqual({ booking: false });
  });

  it("closing the reopened panel changes nothing, sends nothing, and returns focus to the link", async () => {
    await accepted();
    fetchMock.mockClear();
    const before = cookieValue();

    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Close without changing my choices" }),
    );
    await settle();

    expect(banner()).toBeNull();
    expect(cookieValue()).toBe(before);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Cookie preferences" }),
    ).toHaveFocus();
  });

  it("saying yes after clicking the gate and then rejecting unloads the embed (a click does not outlive a decision)", async () => {
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Load the calendar" }));
    expect(container.querySelector("iframe")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await settle();

    expect(container.querySelector("iframe")).toBeNull();
  });

  it("announces the saved choice and returns focus to the footer link", async () => {
    await accepted();
    fireEvent.click(screen.getByRole("button", { name: "Cookie preferences" }));

    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    await settle();

    expect(screen.getByRole("status")).toHaveTextContent("Preferences saved.");
    expect(
      screen.getByRole("button", { name: "Cookie preferences" }),
    ).toHaveFocus();
  });
});
