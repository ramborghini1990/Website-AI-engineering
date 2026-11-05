import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "@/components/language-switcher";
import en from "../../messages/en.json";
import it_ from "../../messages/it.json";

// The real helpers need Next's router; the switcher only relies on this contract:
// `usePathname()` is the path without the locale, `<Link locale href>` prefixes it.
vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/servizi/agenti-ai",
    Link: ({
      href,
      locale,
      prefetch,
      ...rest
    }: {
      href: string;
      locale: string;
      prefetch?: boolean;
    } & ComponentProps<"a">) =>
      createElement("a", {
        href: `/${locale}${href}`,
        "data-prefetch": String(prefetch),
        ...rest,
      }),
  };
});

function renderSwitcher(locale: "it" | "en") {
  const messages = locale === "it" ? it_ : en;
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );
}

describe("LanguageSwitcher", () => {
  it("is a navigation landmark named in the current language", () => {
    renderSwitcher("it");
    expect(
      screen.getByRole("navigation", { name: "Lingua" }),
    ).toBeInTheDocument();

    renderSwitcher("en");
    expect(
      screen.getByRole("navigation", { name: "Language" }),
    ).toBeInTheDocument();
  });

  it("links to the same page in every locale (path preserved)", () => {
    renderSwitcher("it");
    const nav = screen.getByRole("navigation", { name: "Lingua" });

    expect(within(nav).getByRole("link", { name: "Italiano" })).toHaveAttribute(
      "href",
      "/it/servizi/agenti-ai",
    );
    expect(within(nav).getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/en/servizi/agenti-ai",
    );
  });

  it("names each language in its own language and declares lang/hreflang", () => {
    renderSwitcher("en");
    const italiano = screen.getByRole("link", { name: "Italiano" });
    const english = screen.getByRole("link", { name: "English" });

    expect(italiano).toHaveAttribute("lang", "it");
    expect(italiano).toHaveAttribute("hreflang", "it");
    expect(english).toHaveAttribute("lang", "en");
    expect(english).toHaveAttribute("hreflang", "en");
  });

  it("marks only the current language with aria-current", () => {
    renderSwitcher("en");

    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "Italiano" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("does not prefetch the other language's page (no extra requests on load)", () => {
    renderSwitcher("it");

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("offers a hit target of at least 44px high", () => {
    renderSwitcher("it");

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("min-h-11");
    }
  });
});
