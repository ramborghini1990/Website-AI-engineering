import { describe, expect, it } from "vitest";

import {
  featuredDemos,
  homeSectionIndexes,
} from "@/components/home/section-index";
import type { Work } from "@/lib/content/schemas";

describe("homeSectionIndexes", () => {
  it("numbers proof, services, demos and process 1-4 when demos render", () => {
    expect(homeSectionIndexes(true)).toEqual({
      proof: 1,
      services: 2,
      demos: 3,
      process: 4,
    });
  });

  it("stays consecutive (1, 2, 3) with no gap when demos render nothing", () => {
    expect(homeSectionIndexes(false)).toEqual({
      proof: 1,
      services: 2,
      demos: null,
      process: 3,
    });
  });
});

describe("featuredDemos", () => {
  it("keeps interactive demos and drops case studies", () => {
    const demo = { data: { kind: "demo" } as Work };
    const project = { data: { kind: "project" } as Work };

    expect(featuredDemos([project, demo])).toEqual([demo]);
    expect(featuredDemos([project])).toEqual([]);
  });
});
