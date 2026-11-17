// @vitest-environment node
import { describe, expect, it } from "vitest";

import { interactiveDemos } from "@/lib/demos/registry";
import { demoDiagrams } from "./demos";
import { diagramViolations } from "./geometry";

/** The "how this demo works" diagrams (V3): one per interactive demo, 4-5 steps, still. */

describe("demo diagrams", () => {
  it("has a diagram for every interactive demo and for nothing else", () => {
    expect(Object.keys(demoDiagrams).sort()).toEqual(
      [...interactiveDemos].sort(),
    );
  });

  for (const slug of interactiveDemos) {
    const diagram = demoDiagrams[slug];

    it(`${slug}: valid, still, 4 to 5 steps, at most one person (accent) node`, () => {
      expect(diagram.id).toBe(slug);
      expect(diagramViolations(diagram)).toEqual([]);
      expect(diagram.animated).toBe(false);
      expect(diagram.steps.length).toBeGreaterThanOrEqual(4);
      expect(diagram.steps.length).toBeLessThanOrEqual(5);
      expect(
        diagram.nodes.filter((node) => node.tone === "human").length,
      ).toBeLessThanOrEqual(1);
    });
  }

  it("the three demos that involve a person show exactly one human node; the browser-only app has none", () => {
    const humans = (slug: (typeof interactiveDemos)[number]) =>
      demoDiagrams[slug].nodes.filter((node) => node.tone === "human").length;
    expect(humans("instagram-lead-agent")).toBe(1);
    expect(humans("linkedin-assisted-outreach")).toBe(1);
    expect(humans("document-intelligence-demo")).toBe(1);
    expect(humans("business-management-app")).toBe(0);
  });

  it("the business app frames everything in a 'your browser' boundary", () => {
    const business = demoDiagrams["business-management-app"];
    const boundary = business.nodes.find((node) => node.tone === "boundary");
    expect(boundary?.labelKey).toBe("nodes.browser");
    const rest = business.nodes.filter((node) => node.tone !== "boundary");
    expect(rest.every((node) => node.parent === boundary?.id)).toBe(true);
  });
});
