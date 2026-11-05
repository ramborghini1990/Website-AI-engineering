import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import HomePage from "@/app/[locale]/page";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

// The switcher has its own tests; here it only needs to render.
vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <nav aria-label="stub" />,
}));

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
  it("renders exactly one top-level heading", () => {
    renderHome("it");

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
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

  it("is a main landmark", () => {
    renderHome("en");

    expect(screen.getByRole("main")).toBeInTheDocument();
  });
});
