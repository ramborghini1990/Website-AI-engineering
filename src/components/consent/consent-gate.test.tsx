import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsentGate } from "@/components/consent/consent-gate";

const rendered = vi.fn();

/** A stand-in for an embed: if it renders at all, the gate failed to block. */
function Embed() {
  rendered();
  return <iframe src="https://third-party.example/embed" title="the embed" />;
}

function gate() {
  return render(
    <ConsentGate
      category="booking"
      provider="Cal.com"
      title="The calendar is not loaded yet"
      body="Nothing is shared until you load it."
      loadLabel="Load the calendar"
      fallbackHref="https://cal.eu/example/intro"
      fallbackLabel="Open the booking page"
      newTabLabel="(opens in a new tab)"
    >
      <Embed />
    </ConsentGate>,
  );
}

const THIRD_PARTY_ELEMENTS =
  "iframe, script, img, link, object, embed, video, audio, source, frame";

beforeEach(() => {
  rendered.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConsentGate: before the click", () => {
  it("does not render the embed at all, so the browser has nothing to request (negative)", () => {
    const { container } = gate();

    expect(rendered).not.toHaveBeenCalled();
    expect(container.querySelectorAll(THIRD_PARTY_ELEMENTS)).toHaveLength(0);
    expect(container.innerHTML).not.toContain("third-party.example");
  });

  it("makes no fetch and no XMLHttpRequest, and writes nothing to the browser (negative)", () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("XMLHttpRequest", xhrSpy);

    gate();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("says who the third party is and what happens, before anything is loaded", () => {
    gate();

    expect(
      screen.getByText("The calendar is not loaded yet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nothing is shared until you load it."),
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-consent-gate='booking']"),
    ).toHaveAttribute("data-state", "blocked");
  });

  it("offers a real button, not a link, to load it", () => {
    gate();

    const button = screen.getByRole("button", { name: "Load the calendar" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toBeDisabled();
  });

  it("hides that button where scripting is off, since it could do nothing (CSS only)", () => {
    gate();

    expect(
      screen.getByRole("button", { name: "Load the calendar" }).className,
    ).toContain("[@media(scripting:none)]:hidden");
  });

  it("always offers the plain link: external, safe, named, and with its own new-tab notice", () => {
    gate();

    const link = screen.getByRole("link", { name: /Open the booking page/ });
    expect(link).toHaveAttribute("href", "https://cal.eu/example/intro");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link).toHaveAccessibleName(
      "Open the booking page (opens in a new tab)",
    );
  });
});

describe("ConsentGate: after the click", () => {
  it("renders the embed, replaces the placeholder and keeps the plain link", () => {
    const { container } = gate();

    fireEvent.click(screen.getByRole("button", { name: "Load the calendar" }));

    expect(rendered).toHaveBeenCalled();
    expect(container.querySelector("iframe")).toHaveAttribute(
      "src",
      "https://third-party.example/embed",
    );
    expect(
      screen.queryByRole("button", { name: "Load the calendar" }),
    ).toBeNull();
    expect(
      screen.queryByText("Nothing is shared until you load it."),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /Open the booking page/ }),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-consent-gate]")).toHaveAttribute(
      "data-state",
      "loaded",
    );
  });

  it("moves focus to the embed region, for keyboard and screen-reader users", async () => {
    gate();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Load the calendar" }),
      );
      await Promise.resolve();
    });

    const region = screen.getByRole("region", {
      name: "The calendar is not loaded yet",
    });
    expect(region).toHaveFocus();
  });

  it("does not remember the choice: a new visit starts blocked, and nothing was stored", () => {
    gate();
    fireEvent.click(screen.getByRole("button", { name: "Load the calendar" }));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
    cleanup();
    rendered.mockClear();

    const { container } = gate();

    expect(rendered).not.toHaveBeenCalled();
    expect(container.querySelector("iframe")).toBeNull();
  });
});
