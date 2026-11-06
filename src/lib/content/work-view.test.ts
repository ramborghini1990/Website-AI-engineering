// @vitest-environment node
import { describe, expect, it } from "vitest";

import { clientDisclosure } from "@/lib/content/work-view";

const outcomes = [{ label: "Fixture metric", value: "A synthetic value" }];

describe("clientDisclosure: a client is named only with consent", () => {
  it("shows the client and the results of a consenting case study", () => {
    expect(
      clientDisclosure({
        kind: "project",
        clientConsent: true,
        client: "Fixture Client S.r.l.",
        outcomes,
      }),
    ).toEqual({ client: "Fixture Client S.r.l.", outcomes });
  });

  it("shows nothing without consent, even when the object holds a name and results (negative)", () => {
    // The schema refuses this object; the guard must not depend on that.
    expect(
      clientDisclosure({
        kind: "project",
        clientConsent: false,
        client: "Fixture Client S.r.l.",
        outcomes,
      }),
    ).toEqual({ client: null, outcomes: [] });
  });

  it("shows nothing for a demo, even with a consent flag and a name (negative)", () => {
    expect(
      clientDisclosure({
        kind: "demo",
        clientConsent: true,
        client: "Fixture Client S.r.l.",
        outcomes,
      }),
    ).toEqual({ client: null, outcomes: [] });
  });

  it("shows no client for a consenting case study that names none", () => {
    expect(
      clientDisclosure({
        kind: "project",
        clientConsent: true,
        outcomes: [],
      }),
    ).toEqual({ client: null, outcomes: [] });
  });
});
