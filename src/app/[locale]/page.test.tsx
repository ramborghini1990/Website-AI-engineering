import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/[locale]/page";
import { business } from "@/lib/business";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

function renderHome(locale: "it" | "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "it" ? it_ : en}
    >
      <HomePage />
    </NextIntlClientProvider>,
  );
}

describe("Home page (placeholder)", () => {
  it("renders exactly one top-level heading, titled with the brand token from the configuration", () => {
    renderHome("it");

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(business.brand.name);
  });

  it("shows the Italian copy for it and the English copy for en", () => {
    const { unmount } = renderHome("it");
    expect(
      screen.getByText("Il nuovo sito è in costruzione."),
    ).toBeInTheDocument();
    unmount();

    renderHome("en");
    expect(
      screen.getByText("The new website is under construction."),
    ).toBeInTheDocument();
  });

  it("does not render its own <main>: the single landmark comes from the root layout, so the skip link has one target", () => {
    renderHome("en");

    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });
});
