import type { Business } from "@/lib/business";
import type { Service } from "@/lib/content/schemas";

/**
 * schema.org structured data (JSON-LD) for a service page, as pure functions:
 * the page passes the site origin, so nothing here reads the environment.
 *
 * Only facts the site already shows are stated. There is no price, telephone,
 * email, logo, rating or social profile: none exists, and none may be invented
 * (docs/CONTENT.md). The practice is a `ProfessionalService`, which schema.org
 * defines as a subtype of `LocalBusiness` and therefore of `Organization`.
 */

type Origin = string;

const clean = (origin: Origin) => origin.replace(/\/+$/, "");

/** Stable `@id` of the practice, the same on every page so crawlers merge the nodes. */
function organizationId(origin: Origin): string {
  return `${clean(origin)}/#organization`;
}

export type ServiceJsonLdInput = {
  origin: Origin;
  locale: "it" | "en";
  slug: string;
  service: Pick<Service, "title" | "description" | "stack">;
  business: Pick<Business, "brand" | "owner" | "location">;
  /** Names for the breadcrumb: the site's home and the services index. */
  breadcrumb: { home: string; services: string };
};

export function serviceJsonLd(input: ServiceJsonLdInput) {
  const { locale, slug, service, business, breadcrumb } = input;
  const origin = clean(input.origin);
  const pageUrl = `${origin}/${locale}/services/${slug}`;
  const provider = organizationId(origin);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfessionalService",
        "@id": provider,
        name: business.brand.name,
        url: `${origin}/${locale}`,
        founder: { "@type": "Person", name: business.owner.name },
        address: {
          "@type": "PostalAddress",
          streetAddress: business.location.street,
          addressLocality: business.location.municipality,
          addressRegion: business.location.province,
          addressCountry: "IT",
        },
        areaServed: [
          { "@type": "Country", name: "Italia" },
          { "@type": "AdministrativeArea", name: "European Union" },
        ],
        knowsAbout: service.stack,
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: service.title,
        serviceType: service.title,
        description: service.description,
        url: pageUrl,
        provider: { "@id": provider },
        areaServed: [
          { "@type": "Country", name: "Italia" },
          { "@type": "AdministrativeArea", name: "European Union" },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: breadcrumb.home,
            item: `${origin}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: breadcrumb.services,
            item: `${origin}/${locale}/services`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: service.title,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

/**
 * JSON for a `<script type="application/ld+json">` body. `<` is escaped so no
 * string value (even a future one containing `</script>`) can end the element;
 * U+2028/2029 are escaped for old parsers. The result is still valid JSON.
 */
const LINE_SEPARATOR = String.fromCharCode(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029);

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replaceAll("<", String.raw`\u003c`)
    .replaceAll(LINE_SEPARATOR, String.raw`\u2028`)
    .replaceAll(PARAGRAPH_SEPARATOR, String.raw`\u2029`);
}
