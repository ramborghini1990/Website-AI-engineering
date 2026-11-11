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

  it("with the real content, a service links its demo only if that demo is published: AI agents links the Instagram demo (P3.1), document intelligence its own demo (P3.3), the others have none yet", () => {
    const linked: Partial<Record<string, string>> = {
      "ai-agents": "instagram-lead-agent",
      "document-intelligence": "document-intelligence-demo",
    };
    for (const locale of ["it", "en"] as const) {
      for (const service of getServices(locale)) {
        const link = demoFor(service.data.demo, getWork(locale), true);
        const expected = linked[service.slug];
        if (expected !== undefined) {
          expect(link?.slug, `${locale}/${service.slug}`).toBe(expected);
        } else {
          expect(link, `${locale}/${service.slug}`).toBeNull();
        }
      }
    }
  });

  it("a service whose demo is still a draft links nothing (negative)", () => {
    for (const locale of ["it", "en"] as const) {
      const draftDemos = getWork(locale, { includeDrafts: true }).filter(
        (entry) => entry.data.draft,
      );
      expect(draftDemos.length).toBeGreaterThan(0);
      for (const draft of draftDemos) {
        expect(demoFor(draft.slug, getWork(locale), true), draft.slug).toBeNull();
      }
    }
  });
});
