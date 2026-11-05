import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "@/components/ui/button";

describe("Button", () => {
  it("is a type=button by default so it never submits a form by accident", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("lets the caller choose type=submit", () => {
    render(<Button type="submit">Send</Button>);

    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("renders the child element with button styles when asChild is set", () => {
    render(
      <Button asChild variant="secondary">
        <a href="https://example.com/contact">Contact</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Contact" });
    expect(link).toHaveAttribute("href", "https://example.com/contact");
    expect(link).not.toHaveAttribute("type");
    expect(link).toHaveClass("border-border-strong");
  });

  it("uses semantic tokens for each variant", () => {
    expect(buttonVariants({ variant: "primary" })).toContain("bg-accent");
    expect(buttonVariants({ variant: "primary" })).toContain("text-on-accent");
    expect(buttonVariants({ variant: "secondary" })).toContain(
      "border-border-strong",
    );
    expect(buttonVariants({ variant: "tertiary" })).toContain("text-accent");
  });

  it("never offers a size below the 44px hit target", () => {
    expect(buttonVariants({ size: "md" })).toContain("min-h-11");
    expect(buttonVariants({ size: "lg" })).toContain("min-h-12");
    expect(buttonVariants({ size: "icon" })).toContain("size-11");
  });

  it("is disabled when asked", () => {
    render(<Button disabled>Nope</Button>);

    expect(screen.getByRole("button", { name: "Nope" })).toBeDisabled();
  });
});
