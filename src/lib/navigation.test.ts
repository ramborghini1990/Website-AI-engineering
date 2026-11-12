// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  availableNavItems,
  CONTACT_ANCHOR,
  navItems,
  resolveInternalPath,
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

  it("the footer contact block keeps its anchor id", () => {
    expect(CONTACT_ANCHOR).toBe("contact");
  });

  it("services is available now that /services and /services/<slug> exist", () => {
    expect(availableNavItems.map((item) => item.key)).toContain("services");
  });
});

describe("resolveInternalPath: content never links to a page that does not exist", () => {
  it("links to pages that exist", () => {
    expect(resolveInternalPath("/")).toEqual({ kind: "page", href: "/" });
    expect(resolveInternalPath("/services")).toEqual({
      kind: "page",
      href: "/services",
    });
    expect(resolveInternalPath("/services/ai-agents")).toEqual({
      kind: "page",
      href: "/services/ai-agents",
    });
  });

  it("links to the contact page now that it exists (P2.5)", () => {
    expect(resolveInternalPath("/contact")).toEqual({
      kind: "page",
      href: "/contact",
    });
  });

  it("links to the privacy notice now that its page exists (P4.2)", () => {
    expect(resolveInternalPath("/privacy")).toEqual({
      kind: "page",
      href: "/privacy",
    });
  });

  it("links to the work pages now that they exist (P2.4)", () => {
    expect(resolveInternalPath("/work")).toEqual({
      kind: "page",
      href: "/work",
    });
    expect(resolveInternalPath("/work/some-demo")).toEqual({
      kind: "page",
      href: "/work/some-demo",
    });
  });

  it.each(["/process", "/about"])(
    "shows %s as plain text while that page does not exist (negative)",
    (path) => {
      expect(resolveInternalPath(path)).toEqual({ kind: "none" });
    },
  );
});
