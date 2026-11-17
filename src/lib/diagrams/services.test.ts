// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getServices } from "@/lib/content/read";
import type { Locale } from "@/i18n/routing";
import { capabilityMap, serviceCardId } from "./capability-map";
import { diagramViolations } from "./geometry";
import { isServiceSlug, SERVICE_SLUGS, serviceDiagrams } from "./services";

/**
 * The diagrams and glyphs are keyed by service slug, outside the services'
 * strict frontmatter. These tests keep the two in step: a service without a
 * diagram, or a diagram without a service, fails here.
 */

const locales: Locale[] = ["it", "en"];

describe("service diagrams and the content collection", () => {
  for (const locale of locales) {
    it(`${locale}: every service has a diagram and every diagram has a service`, () => {
      const slugs = getServices(locale).map((service) => service.slug);
      expect([...slugs].sort()).toEqual(Object.keys(serviceDiagrams).sort());
      expect([...slugs].sort()).toEqual([...SERVICE_SLUGS].sort());
      for (const slug of slugs) {
        expect(isServiceSlug(slug), slug).toBe(true);
        expect(serviceDiagrams[slug as keyof typeof serviceDiagrams].id).toBe(
          slug,
        );
      }
    });

    it(`${locale}: SERVICE_SLUGS follow the services' order (cards, capability map)`, () => {
      expect(getServices(locale).map((service) => service.slug)).toEqual([
        ...SERVICE_SLUGS,
      ]);
    });
  }

  it("rejects a slug that has no diagram", () => {
    expect(isServiceSlug("not-a-service")).toBe(false);
    expect(isServiceSlug("")).toBe(false);
    expect(isServiceSlug("constructor")).toBe(false);
  });
});

describe("each service diagram", () => {
  for (const slug of SERVICE_SLUGS) {
    const diagram = serviceDiagrams[slug];

    it(`${slug}: is valid, still, and has exactly one human (accent) node`, () => {
      expect(diagramViolations(diagram)).toEqual([]);
      expect(diagram.animated).toBe(false);
      expect(diagram.packet).toBeUndefined();
      expect(
        diagram.nodes.filter((node) => node.tone === "human"),
      ).toHaveLength(1);
    });
  }

  it("ai-agents frames the agent in a permissions boundary and feeds a quality loop", () => {
    const agents = serviceDiagrams["ai-agents"];
    const boundary = agents.nodes.find((node) => node.tone === "boundary");
    expect(boundary?.labelKey).toBe("nodes.permissions");
    expect(agents.edges.some((edge) => edge.kind === "feedback")).toBe(true);
  });

  it("workflow-automation has the step labelled 'Rule' (the 'when AI is not needed' message)", () => {
    const workflow = serviceDiagrams["workflow-automation"];
    expect(workflow.nodes.map((node) => node.labelKey)).toContain("nodes.rule");
    expect(workflow.steps).toContain("rule");
  });
});

describe("the capability map", () => {
  it("has one linked step per service, in the services' order", () => {
    expect(capabilityMap.steps).toEqual([...SERVICE_SLUGS]);
    expect(capabilityMap.nodes.map((node) => node.id)).toEqual([
      ...SERVICE_SLUGS,
    ]);
    expect(diagramViolations(capabilityMap)).toEqual([]);
    expect(capabilityMap.animated).toBe(false);
  });

  it("joins the services in one chain without a direction", () => {
    expect(
      capabilityMap.edges.map((edge) => `${edge.from}>${edge.to}`),
    ).toEqual(
      SERVICE_SLUGS.slice(1).map((slug, i) => `${SERVICE_SLUGS[i]}>${slug}`),
    );
    expect(capabilityMap.edges.every((edge) => edge.kind === "data")).toBe(
      true,
    );
  });

  it("names the card anchor of a service", () => {
    expect(serviceCardId("ai-agents")).toBe("service-ai-agents");
  });
});
