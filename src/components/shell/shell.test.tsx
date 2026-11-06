import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MainNav } from "@/components/shell/main-nav";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { MAIN_CONTENT_ID, SkipLink } from "@/components/shell/skip-link";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import type { Business } from "@/lib/business";
import { business } from "@/lib/business";
import { navItems } from "@/lib/navigation";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

// The real helpers need Next's router. The shell relies on this contract only:
// `usePathname()` is the path without the locale and `<Link>` renders an anchor.
let pathname = "/";
vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => pathname,
    Link: (
      props: {
        href: string;
        locale?: string;
        prefetch?: boolean;
      } & ComponentProps<"a">,
    ) => {
      // `locale` and `prefetch` are router props, not anchor attributes.
      const rest: Record<string, unknown> = { ...props };
      delete rest.locale;
      delete rest.prefetch;
      delete rest.href;
      return createElement("a", {
        href: `/${props.locale ?? "it"}${props.href}`,
        ...rest,
      });
    },
  };
});

type Locale = "it" | "en";

function renderIn(locale: Locale, ui: ReactElement) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "it" ? it_ : en}
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  pathname = "/";
  window.localStorage.clear();
  document.documentElement.className = "";
});

afterEach(() => {
  cleanup();
});

describe("SkipLink", () => {
  it.each([
    ["it", "Vai al contenuto principale"],
    ["en", "Skip to main content"],
  ] as const)("in %s: a link to #main-content", (locale, label) => {
    renderIn(locale, <SkipLink />);

    const link = screen.getByRole("link", { name: label });
    expect(link).toHaveAttribute("href", `#${MAIN_CONTENT_ID}`);
    expect(MAIN_CONTENT_ID).toBe("main-content");
  });

  it("is hidden until it is focused, then shown on top of everything with a 44 px target", () => {
    renderIn("en", <SkipLink />);

    const classes = screen.getByRole("link").className;
    expect(classes).toContain("sr-only");
    expect(classes).toContain("focus:not-sr-only");
    expect(classes).toContain("focus:min-h-11");
    expect(classes).toContain("focus:z-(--z-toast)");
  });
});

describe("MainNav", () => {
  const items = navItems.filter(
    (item) => item.key === "home" || item.key === "services",
  );

  it("is a navigation landmark named in the current language", () => {
    renderIn("it", <MainNav items={items} />);

    expect(
      screen.getByRole("navigation", { name: "Principale" }),
    ).toBeInTheDocument();
  });

  it("renders exactly the items it is given, translated", () => {
    renderIn("en", <MainNav items={items} />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home", "Services"]);
  });

  it("marks the current page with aria-current and an underline (not colour alone)", () => {
    pathname = "/services";
    renderIn("en", <MainNav items={items} />);

    const current = screen.getByRole("link", { name: "Services" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.className).toContain("underline");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("'/' is current only on the home page, not on every page (negative)", () => {
    pathname = "/services";
    renderIn("en", <MainNav items={items} />);

    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("renders no empty landmark when there are no items", () => {
    renderIn("en", <MainNav items={[]} />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("has no link smaller than 44 px (min-h-11)", () => {
    renderIn("en", <MainNav items={items} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.className).toContain("min-h-11");
    }
  });
});

describe("ThemeSwitch", () => {
  const radios = () => screen.getAllByRole("radio");

  it("is a labelled group of three radio buttons: automatic, dark, light", () => {
    renderIn("en", <ThemeSwitch />);

    const group = screen.getByRole("group", { name: "Theme" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((r) => (r as HTMLInputElement).value),
    ).toEqual(["system", "dark", "light"]);
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Automatic/ }),
    ).toBeInTheDocument();
  });

  it("translates its labels", () => {
    renderIn("it", <ThemeSwitch />);

    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Scuro" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Chiaro" })).toBeInTheDocument();
  });

  it("starts on automatic when nothing is stored", () => {
    renderIn("en", <ThemeSwitch />);

    expect(screen.getByRole("radio", { name: /Automatic/ })).toBeChecked();
  });

  it("shows the stored choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    renderIn("en", <ThemeSwitch />);

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
  });

  it("choosing dark applies it to <html>, stores it and checks the radio", () => {
    renderIn("en", <ThemeSwitch />);

    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Automatic/ })).not.toBeChecked();
  });

  it("choosing automatic again clears the class and the stored key", () => {
    renderIn("en", <ThemeSwitch />);
    fireEvent.click(screen.getByRole("radio", { name: "Light" }));

    fireEvent.click(screen.getByRole("radio", { name: /Automatic/ }));

    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it("exactly one option is selected at any time", () => {
    renderIn("en", <ThemeSwitch />);
    for (const name of ["Dark", "Light", /Automatic/]) {
      fireEvent.click(screen.getByRole("radio", { name }));
      expect(
        radios().filter((r) => (r as HTMLInputElement).checked),
      ).toHaveLength(1);
    }
  });

  it("every option is a 44 px target with a name for assistive technology", () => {
    renderIn("en", <ThemeSwitch />);

    for (const radio of radios()) {
      expect(radio.closest("label")?.className).toContain("size-11");
      expect(radio).toHaveAccessibleName();
    }
  });

  it("is enabled once hydrated (it is disabled only on the server, where a choice could not be applied)", () => {
    renderIn("en", <ThemeSwitch />);

    for (const radio of radios()) expect(radio).toBeEnabled();
  });
});

describe("SiteHeader", () => {
  const home = navItems.filter((item) => item.key === "home");

  it("has the wordmark linking home, the nav, the theme, the language switcher and the call to action", () => {
    renderIn("en", <SiteHeader items={home} />);

    const header = screen.getByRole("banner");
    expect(
      within(header).getByRole("link", { name: business.brand.name }),
    ).toHaveAttribute("href", "/it/");
    expect(
      within(header).getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("group", { name: "Theme" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("navigation", { name: "Language" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("link", { name: "Get in touch" }),
    ).toBeInTheDocument();
  });

  it("the primary call to action goes to the contact block in the footer", () => {
    renderIn("it", <SiteHeader items={home} />);

    expect(screen.getByRole("link", { name: "Parliamone" })).toHaveAttribute(
      "href",
      "#contact",
    );
  });

  it("takes the brand from the configuration, not from the copy (so renaming is one edit)", () => {
    renderIn("en", <SiteHeader items={home} brandName="Brand Token" />);

    expect(
      screen.getByRole("link", { name: "Brand Token" }),
    ).toBeInTheDocument();
  });

  it("shows only the available pages: no link to a page that does not exist yet", () => {
    renderIn("en", <SiteHeader />);

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Home", "Services", "Work"]);
  });
});

describe("SiteFooter", () => {
  it("is the contentinfo landmark with the owner, the brand and the Turin location in both languages", () => {
    renderIn("en", <SiteFooter year={2026} />);

    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByText("Ramin Rashidi Alavijeh", { selector: "dd" }),
    ).toBeInTheDocument();
    expect(within(footer).getByText(business.brand.name)).toBeInTheDocument();
    expect(footer).toHaveTextContent(
      "Corso Regina Margherita, Torino (TO), Italy",
    );

    cleanup();
    renderIn("it", <SiteFooter year={2026} />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Corso Regina Margherita, Torino (TO), Italia",
    );
  });

  it("the location is an <address>", () => {
    renderIn("en", <SiteFooter />);

    expect(
      screen.getByRole("contentinfo").querySelector("address"),
    ).toHaveTextContent("Torino (TO)");
  });

  it("shows a neutral placeholder, not an invented value, for every unset identifier", () => {
    renderIn("en", <SiteFooter />);

    const pending = screen
      .getByRole("contentinfo")
      .querySelectorAll("[data-status='pending']");
    expect(pending).toHaveLength(3); // Partita IVA, REA, PEC
    for (const node of pending)
      expect(node).toHaveTextContent("Not yet available");
  });

  it("the placeholder is in Italian too", () => {
    renderIn("it", <SiteFooter />);

    expect(screen.getAllByText("Non ancora disponibile")).toHaveLength(3);
  });

  it("every identifier sits under its own label (a description list)", () => {
    renderIn("en", <SiteFooter />);

    const terms = Array.from(
      screen.getByRole("contentinfo").querySelectorAll("dt"),
    ).map((t) => t.textContent);
    expect(terms).toEqual([
      "Owner",
      "VAT number (Partita IVA)",
      "REA number",
      "PEC (certified email)",
    ]);
  });

  const filled: Business = {
    ...business,
    vatNumber: "12345678903",
    reaNumber: "TO-1234567",
    pec: "owner@pec.example.eu",
  };

  it("shows the real values once they are filled in, and the PEC is a mailto link", () => {
    renderIn("en", <SiteFooter business={filled} />);

    const footer = screen.getByRole("contentinfo");
    expect(footer.querySelectorAll("[data-status='pending']")).toHaveLength(0);
    expect(within(footer).getByText("12345678903")).toBeInTheDocument();
    expect(within(footer).getByText("TO-1234567")).toBeInTheDocument();
    expect(
      within(footer).getByRole("link", { name: "owner@pec.example.eu" }),
    ).toHaveAttribute("href", "mailto:owner@pec.example.eu");
  });

  it("omits the REA row when it does not apply to the legal form (reaNumber: false)", () => {
    renderIn("en", <SiteFooter business={{ ...business, reaNumber: false }} />);

    expect(screen.queryByText("REA number")).not.toBeInTheDocument();
    expect(screen.getByText("VAT number (Partita IVA)")).toBeInTheDocument();
  });

  it("has the contact block the header's call to action points at", () => {
    renderIn("en", <SiteFooter />);

    const contact = screen.getByRole("contentinfo").querySelector("#contact");
    expect(contact).not.toBeNull();
    expect(contact).toHaveAccessibleName("Contact");
  });

  it("states the year and the owner in the rights line", () => {
    renderIn("en", <SiteFooter year={2031} />);

    expect(
      screen.getByText("© 2031 Ramin Rashidi Alavijeh. All rights reserved."),
    ).toBeInTheDocument();
  });

  it("headings are in order below the page's h1 (h2 only)", () => {
    renderIn("en", <SiteFooter />);

    const headings = screen.getAllByRole("heading");
    expect(headings.map((h) => h.tagName)).toEqual(["H2", "H2"]);
  });
});
