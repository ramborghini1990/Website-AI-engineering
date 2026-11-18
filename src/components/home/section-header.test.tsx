import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SectionHeader } from "@/components/home/section-header";

afterEach(cleanup);

describe("SectionHeader", () => {
  it("renders the index as 'NN / Label', hidden from assistive technology", () => {
    render(
      <SectionHeader id="h" title="Title" index={{ n: 1, label: "Metodo" }} />,
    );

    const label = screen.getByText("01 / Metodo");
    expect(label).toHaveAttribute("aria-hidden", "true");
    expect(label.className).toContain("font-mono");
    expect(label.className).toContain("uppercase");
    expect(label.className).toContain("text-text-muted");
    // It sits above the h2 and never becomes part of its name.
    expect(label.compareDocumentPosition(screen.getByRole("heading"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName(
      "Title",
    );
  });

  it("pads one digit and keeps two", () => {
    render(
      <SectionHeader id="h" title="T" index={{ n: 12, label: "Altro" }} />,
    );

    expect(screen.getByText("12 / Altro")).toBeInTheDocument();
  });

  it("renders as before when there is no index: just the h2 and the lead", () => {
    const { container } = render(
      <SectionHeader id="h" title="Title" lead="Lead" />,
    );

    expect(container.querySelector("[aria-hidden]")).toBeNull();
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(screen.getByText("Lead")).toBeInTheDocument();
  });
});
