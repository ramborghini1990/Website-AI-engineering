import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DemoShell } from "@/components/demos/demo-shell";

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

afterEach(() => {
  cleanup();
});

function shell() {
  return render(
    <DemoShell
      id="demo"
      title="Try the demo"
      badge="Simulation"
      disclosure={{ title: "What you see", body: "This is a simulation." }}
      noscript="Needs JavaScript."
      cta={{
        title: "Need this?",
        body: "Tell me about it.",
        label: "Get in touch",
        href: "/contact?service=ai-agents",
      }}
    >
      <p>the demo itself</p>
    </DemoShell>,
  );
}

describe("DemoShell", () => {
  it("is a named section with an h2, a visible Simulation badge and the demo inside", () => {
    shell();

    expect(
      screen.getByRole("region", { name: "Try the demo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Try the demo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Simulation")).toBeVisible();
    expect(screen.getByText("the demo itself")).toBeInTheDocument();
  });

  it("states what the visitor is looking at before anything is touched: in the HTML, not behind an interaction", () => {
    const { container } = shell();

    const disclosure = container.querySelector("[data-demo-disclosure]");
    expect(disclosure).toHaveTextContent("What you see");
    expect(disclosure).toHaveTextContent("This is a simulation.");
    // It comes before the demo in the document.
    const demo = screen.getByText("the demo itself");
    expect(
      (disclosure as Element).compareDocumentPosition(demo) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("has a notice for visitors without JavaScript, hidden unless scripting is off (CSS only)", () => {
    const { container } = shell();

    const notice = container.querySelector("[data-no-js-notice]");
    expect(notice).toHaveTextContent("Needs JavaScript.");
    expect(notice?.className).toContain("hidden");
    expect(notice?.className).toContain("[@media(scripting:none)]:block");
  });

  it("ends with a call to action into the inquiry funnel that pre-selects the service and carries no personal data", () => {
    shell();

    const link = screen.getByRole("link", { name: "Get in touch" });
    expect(link).toHaveAttribute("href", "/it/contact?service=ai-agents");
    expect(link.getAttribute("href")).not.toMatch(/@|name=|email=/);
  });
});
