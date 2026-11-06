// @vitest-environment node
import { describe, expect, it } from "vitest";

import { demoFor } from "@/lib/content/demo-link";
import { getServices, getWork } from "@/lib/content/read";

const published = [
  { slug: "live-demo", data: { title: "A live demo" } },
  { slug: "other-demo", data: { title: "Another demo" } },
];

describe("demoFor", () => {
  it("returns the published demo when its page exists", () => {
    expect(demoFor("live-demo", published, true)).toEqual({
      slug: "live-demo",
      title: "A live demo",
    });
  });

  it("returns null for a service with no demo", () => {
    expect(demoFor(null, published, true)).toBeNull();
  });

  it("returns null while the work pages do not exist, even for a published demo (negative)", () => {
    expect(demoFor("live-demo", published, false)).toBeNull();
  });

  it("returns null when the demo is not in the published list: a draft or planned demo is never advertised (negative)", () => {
    expect(demoFor("draft-demo", published, true)).toBeNull();
    expect(demoFor("live-demo", [], true)).toBeNull();
  });

  it("with the real content, no service links a demo today: every demo is an unpublished draft", () => {
    for (const locale of ["it", "en"] as const) {
      const services = getServices(locale);
      expect(services.some((service) => service.data.demo !== null)).toBe(true);
      for (const service of services) {
        expect(
          demoFor(service.data.demo, getWork(locale), true),
          `${locale}/${service.slug}`,
        ).toBeNull();
      }
    }
  });
});
