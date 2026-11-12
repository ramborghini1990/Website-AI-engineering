import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalDocument } from "@/components/legal/legal-document";
import {
  BusinessDetails,
  ProcessorsTable,
  StorageTable,
  ThirdPartiesTable,
} from "@/components/legal/legal-tables";
import { business } from "@/lib/business";
import { processors, storedKeys, thirdParties } from "@/lib/consent/registry";
import type { LegalFrontmatter } from "@/lib/legal/documents";

import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

afterEach(cleanup);

const locales = [
  ["it", it_],
  ["en", en],
] as const;

const intl = (locale: "it" | "en", messages: typeof en, node: ReactElement) =>
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      {node}
    </NextIntlClientProvider>,
  );

describe.each(locales)("the cookie policy tables (%s)", (locale, messages) => {
  it("StorageTable has one row per stored key, with its type, purpose and duration in this language", () => {
    const { container } = intl(locale, messages, <StorageTable />);

    for (const key of storedKeys) {
      const row = container.querySelector(`[data-storage-key="${key.name}"]`);
      expect(row, key.name).not.toBeNull();
      const text = row?.textContent ?? "";
      expect(text).toContain(key.name);
      expect(text).toContain(messages.legal.storage[key.name].purpose);
      expect(text).toContain(messages.legal.storage[key.name].duration);
      expect(text).toContain(messages.legal.tables.storage.kinds[key.kind]);
    }
    expect(container.querySelectorAll("tbody tr")).toHaveLength(
      storedKeys.length,
    );
  });

  it("is a real table: a caption, column headers and a row header per row, in a focusable, labelled scroll region", () => {
    intl(locale, messages, <StorageTable />);

    const table = screen.getByRole("table", {
      name: messages.legal.tables.storage.caption,
    });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(
      storedKeys.length,
    );
    const region = screen.getByRole("region", {
      name: messages.legal.tables.storage.caption,
    });
    expect(region).toHaveAttribute("tabindex", "0");
  });

  it("ThirdPartiesTable lists each embed with what the provider receives and when it loads", () => {
    const { container } = intl(locale, messages, <ThirdPartiesTable />);

    for (const party of thirdParties) {
      const text =
        container.querySelector(`[data-third-party="${party.id}"]`)
          ?.textContent ?? "";
      expect(text, party.id).toContain(party.provider);
      expect(text).toContain(messages.legal.thirdParties[party.id].data);
      expect(text).toContain(
        messages.legal.tables.thirdParties.triggers[party.trigger],
      );
    }
  });

  it("ProcessorsTable lists every processor, with its job, when and where, so the privacy notice cannot leave one out", () => {
    const { container } = intl(locale, messages, <ProcessorsTable />);

    for (const entry of processors) {
      const text =
        container.querySelector(`[data-processor="${entry.id}"]`)
          ?.textContent ?? "";
      expect(text, entry.id).toContain(entry.name);
      expect(text).toContain(messages.legal.processors[entry.id].purpose);
      expect(text).toContain(messages.legal.processors[entry.id].location);
      expect(text).toContain(
        messages.legal.tables.processors.roles[entry.role],
      );
      expect(text).toContain(
        messages.legal.tables.processors.whens[entry.when],
      );
    }
    expect(container.querySelectorAll("tbody tr")).toHaveLength(
      processors.length,
    );
  });

  it("a registry entry added later is printed too (the table is the registry, not a copy)", () => {
    const first = storedKeys[0];
    const { container } = intl(
      locale,
      messages,
      <StorageTable keys={[first, { ...first, name: "theme" }]} />,
    );

    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});

describe("BusinessDetails", () => {
  it("shows what business.ts has and says 'not yet available' for what it does not: nothing is invented", () => {
    const { container } = intl("en", en, <BusinessDetails />);

    expect(container).toHaveTextContent(business.owner.name);
    expect(container).toHaveTextContent(business.location.municipality);
    expect(
      container.querySelectorAll("[data-status='pending']").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("prints filled-in fiscal data and drops the REA row when it does not apply", () => {
    const { container } = intl(
      "en",
      en,
      <BusinessDetails
        business={{
          ...business,
          vatNumber: "12345678903",
          reaNumber: false,
          pec: "owner@pec.example.eu",
        }}
      />,
    );

    expect(container).toHaveTextContent("12345678903");
    expect(container).toHaveTextContent("owner@pec.example.eu");
    expect(container.querySelectorAll("[data-status='pending']")).toHaveLength(
      0,
    );
    expect(container).not.toHaveTextContent(en.footer.rea);
  });
});

describe("LegalDocument", () => {
  const data: LegalFrontmatter = {
    heading: "A legal document",
    lead: "The lead paragraph of the document, long enough to be a lead.",
    seoTitle: "A legal document",
    description:
      "A description of the legal document that is long enough to pass the schema.",
    version: "2026-11-v3",
    updated: "2026-11-12",
    status: "draft",
  };
  const body =
    "## First\n\nBefore.\n\n[[table:storage]]\n\n## Second\n\nAfter.\n";

  it("has one h1, the version and the date, the draft notice, and the table exactly where the text asks for it", () => {
    const { container } = intl(
      "en",
      en,
      <LegalDocument current="privacy" data={data} body={body} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "A legal document" }),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-legal-version]")).toHaveTextContent(
      "Version 2026-11-v3",
    );
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-11-12",
    );
    expect(container.querySelector("time")).toHaveTextContent(
      "November 12, 2026",
    );
    expect(
      container.querySelector("[data-legal-status='draft']"),
    ).not.toBeNull();

    const order = [
      "Before.",
      "Cookies and data this site saves in your browser",
      "After.",
    ].map((needle) => container.textContent.indexOf(needle));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows no draft notice once the text is published", () => {
    const { container } = intl(
      "en",
      en,
      <LegalDocument
        current="privacy"
        data={{ ...data, status: "published" }}
        body={body}
      />,
    );

    expect(container.querySelector("[data-legal-status]")).toBeNull();
  });

  it("links to the other three documents and not to itself", () => {
    intl("en", en, <LegalDocument current="terms" data={data} body={body} />);

    const nav = screen.getByRole("navigation", {
      name: en.legal.otherDocuments,
    });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      en.legal.titles.privacy,
      en.legal.titles["cookie-policy"],
      en.legal.titles.legal,
    ]);
  });

  it("writes the date in the page's language", () => {
    const { container } = intl(
      "it",
      it_,
      <LegalDocument current="terms" data={data} body={body} />,
    );

    expect(container.querySelector("time")).toHaveTextContent(
      "12 novembre 2026",
    );
  });
});
