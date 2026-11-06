// @vitest-environment node
import { describe, expect, it } from "vitest";

import { business } from "@/lib/business";
import { jsonLdString, serviceJsonLd } from "@/lib/structured-data";

const service = {
  title: "Agenti AI autonomi",
  description:
    "Progetto agenti AI che qualificano contatti, smistano richieste e rispondono sui tuoi documenti.",
  stack: ["TypeScript", "Next.js"],
};

const build = (overrides: Partial<Parameters<typeof serviceJsonLd>[0]> = {}) =>
  serviceJsonLd({
    origin: "https://example.test",
    locale: "it",
    slug: "ai-agents",
    service,
    business,
    breadcrumb: { home: "Home", services: "Servizi" },
    ...overrides,
  });

type Node = Record<string, unknown> & { "@type": string };
const nodes = (data = build()) => data["@graph"] as unknown as Node[];
const byType = (type: string) => {
  const found = nodes().find((node) => node["@type"] === type);
  if (!found) throw new Error(`no ${type} node`);
  return found;
};

describe("serviceJsonLd", () => {
  it("is a schema.org graph with the practice, the service and the breadcrumb", () => {
    expect(build()["@context"]).toBe("https://schema.org");
    expect(nodes().map((node) => node["@type"])).toEqual([
      "ProfessionalService",
      "Service",
      "BreadcrumbList",
    ]);
  });

  it("describes the service from its content, with absolute URLs for the page", () => {
    const node = byType("Service");

    expect(node).toMatchObject({
      name: service.title,
      description: service.description,
      url: "https://example.test/it/services/ai-agents",
    });
  });

  it("links the service to the practice by @id (the same id on every page)", () => {
    const practice = byType("ProfessionalService");
    const id = "https://example.test/#organization";

    expect(practice["@id"]).toBe(id);
    expect(byType("Service")["provider"]).toEqual({ "@id": id });
    expect(
      serviceJsonLd({
        origin: "https://example.test/",
        locale: "en",
        slug: "web-applications",
        service,
        business,
        breadcrumb: { home: "Home", services: "Services" },
      })["@graph"][0]["@id"],
    ).toBe(id);
  });

  it("states only facts the site already shows: name, owner, address, area, technologies", () => {
    const practice = byType("ProfessionalService");

    expect(practice).toMatchObject({
      name: business.brand.name,
      founder: { name: business.owner.name },
      address: {
        addressLocality: business.location.municipality,
        addressRegion: business.location.province,
        addressCountry: "IT",
      },
      knowsAbout: service.stack,
    });
  });

  it("invents nothing: no price, contact detail, logo, rating, review or social profile", () => {
    const text = JSON.stringify(build());

    for (const key of [
      "telephone",
      "email",
      "priceRange",
      "price",
      "logo",
      "image",
      "aggregateRating",
      "review",
      "sameAs",
      "vatID",
      "taxID",
      "offers",
    ]) {
      expect(text, key).not.toContain(`"${key}"`);
    }
  });

  it("builds a three-level breadcrumb with consecutive positions and absolute URLs", () => {
    const items = byType("BreadcrumbList")["itemListElement"] as Array<{
      position: number;
      name: string;
      item: string;
    }>;

    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items.map((item) => item.name)).toEqual([
      "Home",
      "Servizi",
      service.title,
    ]);
    expect(items.map((item) => item.item)).toEqual([
      "https://example.test/it",
      "https://example.test/it/services",
      "https://example.test/it/services/ai-agents",
    ]);
  });
});

describe("jsonLdString", () => {
  it("round-trips to the same data", () => {
    const data = build();

    expect(JSON.parse(jsonLdString(data))).toEqual(
      JSON.parse(JSON.stringify(data)),
    );
  });

  it("cannot be used to close the script element (negative)", () => {
    const text = jsonLdString({ name: "</script><script>alert(1)</script>" });

    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });

  it("escapes the line and paragraph separators", () => {
    const text = jsonLdString({
      name: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`,
    });

    expect(text).not.toContain(String.fromCharCode(0x2028));
    expect(text).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(text)).toEqual({
      name: `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`,
    });
  });
});
