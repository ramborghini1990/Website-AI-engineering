import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Options = {
  sitekey: string;
  theme: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

// The module keeps a loading promise, so each test starts from a fresh copy.
async function load() {
  vi.resetModules();
  return (await import("@/components/contact/turnstile-widget"))
    .TurnstileWidget;
}

const scripts = () =>
  document.head.querySelectorAll('script[src*="challenges.cloudflare.com"]');

beforeEach(() => {
  document.head.innerHTML = "";
  delete window.turnstile;
});

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe("TurnstileWidget", () => {
  it("requests the Cloudflare script only when it mounts, from Cloudflare's own origin, once", async () => {
    const TurnstileWidget = await load();
    expect(scripts()).toHaveLength(0);

    render(<TurnstileWidget siteKey="site-key" onToken={() => undefined} />);
    render(<TurnstileWidget siteKey="site-key" onToken={() => undefined} />);

    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute("src")).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
    );
  });

  it("renders the widget with the site key once the script is ready, and hands tokens to the form", async () => {
    const TurnstileWidget = await load();
    const onToken = vi.fn();
    let options: Options | undefined;
    const api = {
      render: vi.fn((_el: HTMLElement, given: Options) => {
        options = given;
        return "widget-1";
      }),
      remove: vi.fn(),
    };

    render(<TurnstileWidget siteKey="site-key" onToken={onToken} />);
    window.turnstile = api;
    (scripts()[0] as HTMLScriptElement).onload?.(new Event("load"));
    await vi.waitFor(() => {
      expect(api.render).toHaveBeenCalledTimes(1);
    });

    expect(options?.sitekey).toBe("site-key");
    options?.callback("token-1");
    expect(onToken).toHaveBeenLastCalledWith("token-1");
    options?.["expired-callback"]();
    expect(onToken).toHaveBeenLastCalledWith("");
    options?.["error-callback"]();
    expect(onToken).toHaveBeenLastCalledWith("");
  });

  it("removes the widget when it unmounts", async () => {
    const TurnstileWidget = await load();
    const api = { render: vi.fn(() => "widget-9"), remove: vi.fn() };
    const view = render(
      <TurnstileWidget siteKey="site-key" onToken={() => undefined} />,
    );
    window.turnstile = api;
    (scripts()[0] as HTMLScriptElement).onload?.(new Event("load"));
    await vi.waitFor(() => {
      expect(api.render).toHaveBeenCalled();
    });

    view.unmount();

    expect(api.remove).toHaveBeenCalledWith("widget-9");
  });

  it("gives an empty token, not an error, when the script is blocked (negative)", async () => {
    const TurnstileWidget = await load();
    const onToken = vi.fn();

    render(<TurnstileWidget siteKey="site-key" onToken={onToken} />);
    (scripts()[0] as HTMLScriptElement).onerror?.(new Event("error"));

    await vi.waitFor(() => {
      expect(onToken).toHaveBeenCalledWith("");
    });
  });

  it("does not render into a widget that was unmounted before the script loaded", async () => {
    const TurnstileWidget = await load();
    const api = { render: vi.fn(() => "w"), remove: vi.fn() };
    const view = render(
      <TurnstileWidget siteKey="site-key" onToken={() => undefined} />,
    );

    view.unmount();
    window.turnstile = api;
    (scripts()[0] as HTMLScriptElement).onload?.(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();

    expect(api.render).not.toHaveBeenCalled();
  });
});
