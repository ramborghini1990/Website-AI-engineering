import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyTheme,
  readStoredTheme,
  subscribeTheme,
  THEME_STORAGE_KEY,
  themeInitScript,
} from "@/lib/theme";

const root = () => document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  root().className = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("applyTheme / readStoredTheme", () => {
  it("dark and light add the class and are remembered", () => {
    applyTheme("dark");
    expect(root().classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readStoredTheme()).toBe("dark");

    applyTheme("light");
    expect(root().classList.contains("light")).toBe(true);
    expect(root().classList.contains("dark")).toBe(false); // never both
    expect(readStoredTheme()).toBe("light");
  });

  it("system removes the class and forgets the choice (nothing is kept on the device)", () => {
    applyTheme("dark");

    applyTheme("system");

    expect(root().classList.contains("dark")).toBe(false);
    expect(root().classList.contains("light")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readStoredTheme()).toBe("system");
  });

  it("stores exactly one key, and nothing else", () => {
    applyTheme("dark");

    expect(window.localStorage.length).toBe(1);
    expect(THEME_STORAGE_KEY).toBe("theme");
  });

  it("ignores a stored value that is neither dark nor light (negative)", () => {
    for (const value of ["", "blue", "DARK", "<script>", "system"]) {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
      expect(readStoredTheme(), value).toBe("system");
    }
  });

  it("never throws when storage is blocked, and the choice still applies to the page", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readStoredTheme()).toBe("system");
    expect(() => {
      applyTheme("light");
    }).not.toThrow();
    expect(root().classList.contains("light")).toBe(true);
  });
});

describe("subscribeTheme", () => {
  it("notifies on a change made in this tab and stops after unsubscribe", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeTheme(onChange);

    applyTheme("dark");
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    applyTheme("light");
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("follows a change made in ANOTHER tab: re-applies the class and notifies", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeTheme(onChange);

    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    window.dispatchEvent(
      new StorageEvent("storage", { key: THEME_STORAGE_KEY }),
    );

    expect(root().classList.contains("light")).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("ignores storage changes to other keys (negative)", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeTheme(onChange);

    window.dispatchEvent(
      new StorageEvent("storage", { key: "something-else" }),
    );

    expect(onChange).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("themeInitScript (runs before first paint)", () => {
  // Executed the way the browser does: as an inline <script> in the document.
  const run = () => {
    const script = document.createElement("script");
    script.textContent = themeInitScript;
    document.head.append(script);
    script.remove();
  };

  it.each(["dark", "light"])("applies a stored %s theme", (choice) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);

    run();

    expect(root().classList.contains(choice)).toBe(true);
  });

  it("does nothing without a stored choice (the system preference decides)", () => {
    run();

    expect(root().className).toBe("");
  });

  it("ignores an unexpected stored value: it can never inject a class (negative)", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "x y-evil");

    run();

    expect(root().className).toBe("");
  });

  it("does not throw when storage is blocked (private mode)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(run).not.toThrow();
  });

  it("is a small constant: no user input, no characters that need HTML escaping", () => {
    expect(themeInitScript.length).toBeLessThan(300);
    expect(themeInitScript).not.toMatch(/[<>&]/);
    expect(themeInitScript).toContain(JSON.stringify(THEME_STORAGE_KEY));
  });
});
