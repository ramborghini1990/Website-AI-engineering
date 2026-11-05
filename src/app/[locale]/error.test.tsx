import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/[locale]/error";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    Link: ({ href, ...rest }: { href: string } & ComponentProps<"a">) =>
      createElement("a", { href, ...rest }),
  };
});

function renderError(locale: "it" | "en", reset = vi.fn()) {
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "it" ? it_ : en}
    >
      <ErrorPage reset={reset} />
    </NextIntlClientProvider>,
  );
  return reset;
}

describe("error page (500)", () => {
  it("says something went wrong, in the visitor's language, under one h1", () => {
    renderError("it");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Qualcosa è andato storto",
      }),
    ).toBeInTheDocument();
  });

  it("offers a retry that calls reset, and a way home", () => {
    const reset = renderError("en");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("link", { name: "Back to the home page" }),
    ).toHaveAttribute("href", "/");
  });

  it("never shows anything about the error itself (no message, no stack, no digest)", () => {
    // The component does not even receive the error: it cannot leak it.
    renderError("en");

    expect(document.body.textContent).not.toMatch(/stack|digest|at \w+\s*\(/i);
    expect(ErrorPage.length).toBe(1);
  });
});
