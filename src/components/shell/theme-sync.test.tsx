import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeSync } from "@/components/shell/theme-sync";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const root = () => document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  root().className = "";
});

afterEach(() => {
  cleanup();
});

describe("ThemeSync", () => {
  it("renders nothing", () => {
    const { container } = render(<ThemeSync />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(["dark", "light"])(
    "puts the stored %s theme back on <html> (what a remounted root layout loses)",
    (choice) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
      root().className = "font-variable antialiased"; // a fresh <html>: no theme class

      render(<ThemeSync />);

      expect(root().classList.contains(choice)).toBe(true);
      expect(root().classList.contains("antialiased")).toBe(true); // other classes are untouched
    },
  );

  it("adds nothing when no choice is stored: the system preference decides", () => {
    render(<ThemeSync />);

    expect(root().classList.contains("dark")).toBe(false);
    expect(root().classList.contains("light")).toBe(false);
  });

  it("leaves a class it did not set alone when nothing is stored (hydration must not clobber devtools, extensions or tests)", () => {
    root().classList.add("dark");

    render(<ThemeSync />);

    expect(root().classList.contains("dark")).toBe(true);
  });

  it("replaces a different theme class with the stored one (never both)", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    root().classList.add("dark");

    render(<ThemeSync />);

    expect(root().classList.contains("light")).toBe(true);
    expect(root().classList.contains("dark")).toBe(false);
  });
});
