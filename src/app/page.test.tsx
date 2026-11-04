import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home page (scaffold)", () => {
  it("renders exactly one top-level heading", () => {
    render(<Home />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("gives the logo image a text alternative", () => {
    render(<Home />);

    expect(
      screen.getByRole("img", { name: /next\.js logo/i }),
    ).toBeInTheDocument();
  });
});
