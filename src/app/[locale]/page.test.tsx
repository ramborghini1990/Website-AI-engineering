import { cleanup, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/[locale]/page";
import { getWork as realGetWork } from "@/lib/content/read";
import it_ from "../../../messages/it.json";

vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: () => () => createElement("span", { "data-motion-stub": "" }),
  };
});

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

vi.mock("next-intl/server", () => ({
  getLocale: () => Promise.resolve("it"),
}));

// Lets one test pretend that no demo is published.
const published = vi.hoisted(() => ({ none: false }));
vi.mock("@/lib/content/read", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/content/read")>();
  return {
    ...actual,
    getWork: (...args: Parameters<typeof actual.getWork>) =>
      published.none ? [] : actual.getWork(...args),
  };
});

afterEach(() => {
  cleanup();
  published.none = false;
});

async function indexLabels() {
  render(
    <NextIntlClientProvider locale="it" messages={it_}>
      {await HomePage()}
    </NextIntlClientProvider>,
  );
  return [...document.querySelectorAll("span[aria-hidden='true']")]
    .map((node) => node.textContent)
    .filter((text) => /^\d\d \/ /.test(text));
}

describe("Home section index labels", () => {
  it("are 01-04 in order when the demos section renders", async () => {
    expect(realGetWork("it").length).toBeGreaterThan(0);

    expect(await indexLabels()).toEqual([
      "01 / Metodo",
      "02 / Servizi",
      "03 / Demo",
      "04 / Processo",
    ]);
  });

  it("stay consecutive (01-03) when no demo is published and the section is absent", async () => {
    published.none = true;

    expect(await indexLabels()).toEqual([
      "01 / Metodo",
      "02 / Servizi",
      "03 / Processo",
    ]);
  });
});
