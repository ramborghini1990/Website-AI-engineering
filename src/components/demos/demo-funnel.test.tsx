import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DemoCta,
  DemoStartTracker,
  useDemoCompleted,
} from "@/components/demos/demo-funnel";
import { resetTrackedEvents, isOptedOut } from "@/lib/analytics/client";

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

const DEMO = "instagram-lead-agent";
const fetchMock = vi.fn<typeof fetch>();

const bodyOf = (init: RequestInit | undefined): Record<string, string> =>
  JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<
    string,
    string
  >;

/** The `{ event, demo }` bodies reported so far. */
const reported = () => fetchMock.mock.calls.map(([, init]) => bodyOf(init));

function Completes({ done }: { done: boolean }) {
  useDemoCompleted(DEMO, done);
  return null;
}

beforeEach(() => {
  resetTrackedEvents();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("demo funnel events", () => {
  it("reports nothing on a page view: only a click starts the funnel", () => {
    render(
      <DemoStartTracker demo={DEMO}>
        <button type="button">inside</button>
      </DemoStartTracker>,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the first click inside the demo is demo_started, once per page view", () => {
    render(
      <DemoStartTracker demo={DEMO}>
        <button type="button">inside</button>
      </DemoStartTracker>,
    );

    fireEvent.click(screen.getByRole("button", { name: "inside" }));
    fireEvent.click(screen.getByRole("button", { name: "inside" }));

    expect(reported()).toEqual([{ event: "demo_started", demo: DEMO }]);
  });

  it("the request is first party, carries only { event, demo } and sends no credentials", () => {
    render(
      <DemoStartTracker demo={DEMO}>
        <button type="button">inside</button>
      </DemoStartTracker>,
    );
    fireEvent.click(screen.getByRole("button", { name: "inside" }));

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/demo-events");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "omit",
      keepalive: true,
    });
    expect(Object.keys(bodyOf(init)).sort()).toEqual(["demo", "event"]);
    expect(Object.keys(init?.headers ?? {})).toEqual(["content-type"]);
  });

  it("completing reports demo_completed once, after the demo_started it implies", () => {
    const { rerender } = render(<Completes done={false} />);
    expect(fetchMock).not.toHaveBeenCalled();

    rerender(<Completes done />);
    rerender(<Completes done={false} />);
    rerender(<Completes done />);

    expect(reported()).toEqual([
      { event: "demo_started", demo: DEMO },
      { event: "demo_completed", demo: DEMO },
    ]);
  });

  it("each click on the call to action is cta_clicked, and the link still works", () => {
    render(
      <DemoCta demo={DEMO} href="/contact?service=ai-agents" label="Go" />,
    );

    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("href", "/it/contact?service=ai-agents");
    fireEvent.click(link);
    fireEvent.click(link);

    expect(reported()).toEqual([
      { event: "cta_clicked", demo: DEMO },
      { event: "cta_clicked", demo: DEMO },
    ]);
  });

  it("negative: nothing is stored in the browser and no cookie is written", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const cookie = vi.spyOn(document, "cookie", "set");
    render(
      <>
        <DemoStartTracker demo={DEMO}>
          <button type="button">inside</button>
        </DemoStartTracker>
        <DemoCta demo={DEMO} href="/contact" label="Go" />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "inside" }));
    fireEvent.click(screen.getByRole("link", { name: "Go" }));

    expect(fetchMock).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
  });

  it("negative: with Do Not Track or Global Privacy Control on, nothing is sent", () => {
    vi.stubGlobal("navigator", { doNotTrack: "1" });
    render(<DemoCta demo={DEMO} href="/contact" label="Go" />);

    fireEvent.click(screen.getByRole("link", { name: "Go" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(isOptedOut({ doNotTrack: "1" })).toBe(true);
    expect(isOptedOut({ globalPrivacyControl: true })).toBe(true);
    expect(isOptedOut({ doNotTrack: "0", globalPrivacyControl: false })).toBe(
      false,
    );
  });

  it("a failed report never disturbs the visitor", () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<DemoCta demo={DEMO} href="/contact" label="Go" />);

    expect(() => {
      fireEvent.click(screen.getByRole("link", { name: "Go" }));
    }).not.toThrow();
  });
});
