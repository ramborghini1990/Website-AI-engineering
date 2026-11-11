// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  budgetValues,
  firstStepWithError,
  needForService,
  needValues,
  parseInquiry,
  parseStep,
  readFields,
  stepFields,
  stepIds,
  timelineValues,
  type RawInquiry,
} from "@/lib/inquiry/schema";

const valid: RawInquiry = {
  need: "ai-agents",
  description:
    "We receive many repeated requests by email and want to sort them automatically.",
  budget: "5k-15k",
  timeline: "one-to-three-months",
  name: "Anna Test",
  email: "anna.test@example.com",
  company: "Example S.r.l.",
  marketingConsent: false,
};

describe("parseInquiry", () => {
  it("accepts a complete, valid inquiry", () => {
    const result = parseInquiry(valid);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.need).toBe("ai-agents");
    expect(result.ok && result.data.marketingConsent).toBe(false);
  });

  it("trims text and treats a blank company as absent", () => {
    const result = parseInquiry({
      ...valid,
      name: "  Anna Test  ",
      company: "   ",
    });

    expect(result.ok && result.data.name).toBe("Anna Test");
    expect(result.ok && result.data.company).toBeUndefined();
  });

  it("the marketing consent is optional and defaults to unticked in the form (false)", () => {
    expect(parseInquiry(valid).ok).toBe(true);
    const ticked = parseInquiry({ ...valid, marketingConsent: true });
    expect(ticked.ok && ticked.data.marketingConsent).toBe(true);
  });

  it("every option list matches the copy keys (needs, budget bands, timelines)", () => {
    expect(needValues).toHaveLength(5);
    expect(budgetValues).toHaveLength(5);
    expect(timelineValues).toHaveLength(4);
  });

  it.each([
    ["no need", { need: undefined }, "need", "required"],
    ["an unknown need", { need: "everything" }, "need", "invalid"],
    [
      "a too short description",
      { description: "too short" },
      "description",
      "tooShort",
    ],
    ["an empty description", { description: "   " }, "description", "required"],
    [
      "a huge description",
      { description: "x".repeat(2001) },
      "description",
      "tooLong",
    ],
    ["an unknown budget", { budget: "1000000" }, "budget", "invalid"],
    ["no timeline", { timeline: undefined }, "timeline", "required"],
    ["an unknown timeline", { timeline: "yesterday" }, "timeline", "invalid"],
    ["a one-letter name", { name: "A" }, "name", "tooShort"],
    [
      "a name with a line break",
      { name: "Anna\nBcc: x@y.z" },
      "name",
      "invalid",
    ],
    [
      "a name with a control character",
      { name: "Anna\u0000Test" },
      "name",
      "invalid",
    ],
    ["a malformed email", { email: "not-an-email" }, "email", "invalid"],
    [
      "an email with a display name",
      { email: "Anna <anna@example.com>" },
      "email",
      "invalid",
    ],
    ["an empty email", { email: "" }, "email", "required"],
    [
      "a very long email",
      { email: `${"a".repeat(250)}@example.com` },
      "email",
      "tooLong",
    ],
    [
      "a company with a line break",
      { company: "Ex\nample" },
      "company",
      "invalid",
    ],
  ])("rejects %s (negative)", (_name, override, field, code) => {
    const result = parseInquiry({ ...valid, ...override });

    expect(result.ok).toBe(false);
    expect(
      !result.ok && result.errors[field as keyof typeof result.errors],
    ).toBe(code);
  });

  it("reports one error per field and only for known fields", () => {
    const result = parseInquiry({});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["budget", "description", "email", "name", "need", "timeline"].sort(),
      );
      expect(Object.values(result.errors).every((c) => c === "required")).toBe(
        true,
      );
    }
  });

  it("ignores keys the schema does not know (they never reach the record)", () => {
    const result = parseInquiry({
      ...valid,
      isAdmin: "true",
      id: "1",
    } as unknown as RawInquiry);

    expect(result.ok && Object.keys(result.data).sort()).toEqual(
      [
        "budget",
        "company",
        "description",
        "email",
        "marketingConsent",
        "name",
        "need",
        "timeline",
      ].sort(),
    );
  });
});

describe("parseStep", () => {
  it.each([
    ["need", { need: "ai-agents", description: valid.description }],
    ["budget", { budget: "undecided" }],
    ["timeline", { timeline: "exploring" }],
    [
      "contact",
      { name: "Anna Test", email: "a@example.com", marketingConsent: false },
    ],
  ] as const)("accepts a valid %s step", (step, raw) => {
    expect(parseStep(step, raw).ok).toBe(true);
  });

  it("checks only the fields of that step", () => {
    const result = parseStep("budget", { budget: "5k-15k" });

    expect(result.ok).toBe(true);
    const bad = parseStep("need", { need: "ai-agents" });
    expect(!bad.ok && Object.keys(bad.errors)).toEqual(["description"]);
  });

  it("covers every field exactly once across the steps", () => {
    const all = stepIds.flatMap((step) => stepFields[step]);

    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual(
      [
        "budget",
        "company",
        "description",
        "email",
        "marketingConsent",
        "name",
        "need",
        "timeline",
      ].sort(),
    );
  });
});

describe("firstStepWithError", () => {
  it("finds the earliest step that has an error", () => {
    expect(firstStepWithError({ email: "invalid", budget: "required" })).toBe(
      "budget",
    );
    expect(firstStepWithError({ email: "invalid" })).toBe("contact");
    expect(firstStepWithError({})).toBeNull();
  });
});

describe("readFields", () => {
  it("picks the known fields out of FormData and ignores the rest", () => {
    const form = new FormData();
    form.set("need", "ai-agents");
    form.set("description", "x".repeat(30));
    form.set("$ACTION_ID_abc", "1");
    form.set("website", "http://spam.example");
    form.set("unknown", "x");

    const raw = readFields(form);

    expect(Object.keys(raw).sort()).toEqual([
      "description",
      "marketingConsent",
      "need",
    ]);
  });

  it("an unticked checkbox is false, a ticked one is true", () => {
    const off = new FormData();
    expect(readFields(off).marketingConsent).toBe(false);
    const on = new FormData();
    on.set("marketingConsent", "on");
    expect(readFields(on).marketingConsent).toBe(true);
  });

  it("a hostile value for the checkbox does not count as consent (negative)", () => {
    const form = new FormData();
    form.set("marketingConsent", "yes please");

    expect(readFields(form).marketingConsent).toBe(false);
  });

  it("ignores files", () => {
    const form = new FormData();
    form.set("name", new File(["x"], "x.txt"));

    expect(readFields(form).name).toBeUndefined();
  });

  it("reads a plain record too", () => {
    expect(readFields({ need: "ai-agents", marketingConsent: true })).toEqual({
      need: "ai-agents",
      marketingConsent: true,
    });
  });
});

describe("needForService (?service= on the contact page)", () => {
  it.each([
    ["ai-agents", "ai-agents"],
    ["workflow-automation", "workflow-automation"],
    ["web-applications", "web-application"],
    ["document-intelligence", "document-intelligence"],
  ])("maps the service %s to the need %s", (service, need) => {
    expect(needForService(service)).toBe(need);
  });

  it("takes the first value of a repeated parameter", () => {
    expect(needForService(["ai-agents", "web-applications"])).toBe("ai-agents");
  });

  it.each([
    undefined,
    "",
    "nope",
    "AI-AGENTS",
    "not-sure",
    "__proto__",
    "constructor",
    "toString",
    "<script>",
    "ai-agents ",
  ])("ignores %j: only the four known services count (negative)", (value) => {
    expect(needForService(value)).toBeUndefined();
  });
});
