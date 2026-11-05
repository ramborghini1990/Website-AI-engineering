// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  availableNavItems,
  contactHref,
  CONTACT_ANCHOR,
  navItems,
} from "@/lib/navigation";

const APP = fileURLToPath(new URL("../app/[locale]", import.meta.url));

/** Route paths (without the locale) that have a page file under src/app/[locale]. */
function existingRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (!name.startsWith("[") && name !== "dev-tools")
          walk(full, `${prefix}/${name}`);
      } else if (/^page\.tsx?$/.test(name)) {
        routes.add(prefix === "" ? "/" : prefix);
      }
    }
  };
  walk(APP, "");
  return routes;
}

describe("navigation", () => {
  it("only lists items whose page exists: the header never links to a 404 (guard for flipping `available`)", () => {
    const routes = existingRoutes();

    for (const item of availableNavItems) {
      expect(routes.has(item.href), `${item.key} -> ${item.href}`).toBe(true);
    }
  });

  it("every planned item is declared once, with a locale-less absolute path", () => {
    expect(new Set(navItems.map((item) => item.key)).size).toBe(
      navItems.length,
    );
    for (const item of navItems) expect(item.href).toMatch(/^\/[a-z-]*$/);
  });

  it("home is available (the nav landmark is never empty on a real page)", () => {
    expect(availableNavItems.map((item) => item.key)).toContain("home");
  });

  it("the call to action points at the footer contact block", () => {
    expect(contactHref).toBe(`#${CONTACT_ANCHOR}`);
  });
});
