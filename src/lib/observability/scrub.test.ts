// @vitest-environment node
import { describe, expect, it } from "vitest";

import { scrubError } from "@/lib/observability/scrub";

/** Synthetic personal data planted everywhere an error can carry it. */
const PLANTED = [
  "anna.rossi@example.com",
  "203.0.113.42",
  "+39 347 123 4567",
  "Anna Rossi",
  "sk-ant-api03-AbCdEf1234567890xyz",
  "C:\\Users\\annarossi\\repo",
  "/home/annarossi/repo",
  "s3cr3tsessioncookie",
];

function hostileError(): Error & { digest: string } {
  const error = new Error(
    `Invalid input from Anna Rossi <anna.rossi@example.com> ip 203.0.113.42 tel +39 347 123 4567 key sk-ant-api03-AbCdEf1234567890xyz`,
  ) as Error & { digest: string };
  error.digest = "1234567890";
  error.stack = [
    "Error: Invalid input from Anna Rossi <anna.rossi@example.com>",
    "    at submitInquiry (C:\\Users\\annarossi\\repo\\src\\lib\\inquiry\\action.ts:42:13)",
    "    at async Object.run (/home/annarossi/repo/.next/server/chunks/ssr/route.js?cookie=s3cr3tsessioncookie:7:9)",
    "    at webpack-internal:///(rsc)/./src/app/page.tsx:1:2",
    "    at node:internal/process/task_queues:105:5",
  ].join("\n");
  return error;
}

const context = {
  routePath: "/[locale]/work/[slug]",
  routeType: "render",
};
// What Next passes: the real URL (with a query holding personal data) and headers. Not read.
const request = {
  method: "POST",
  path: "/it/contatti?email=anna.rossi@example.com",
  headers: {
    cookie: "session=s3cr3tsessioncookie",
    "x-forwarded-for": "203.0.113.42",
  },
};

describe("scrubError", () => {
  it("builds the report from safe facts only", () => {
    const report = scrubError(hostileError(), request, context);

    expect(report).toMatchObject({
      errorClass: "Error",
      digest: "1234567890",
      route: "/[locale]/work/[slug]",
      routeType: "render",
      method: "POST",
    });
    // Oldest call first; file base names only, never a directory.
    expect(report.frames.map((frame) => frame.filename)).toEqual([
      "task_queues",
      "page.tsx",
      "route.js",
      "action.ts",
    ]);
    expect(report.frames.at(-1)).toMatchObject({
      function: "submitInquiry",
      lineno: 42,
      colno: 13,
    });
  });

  it("carries none of the planted personal data anywhere (negative)", () => {
    const serialised = JSON.stringify(
      scrubError(hostileError(), request, context),
    );

    for (const secret of PLANTED) expect(serialised).not.toContain(secret);
    expect(serialised).not.toMatch(/annarossi|Anna|cookie|message/i);
  });

  it("never includes the message, even if it is harmless", () => {
    const report = scrubError(new Error("boom"), {}, {});

    expect(JSON.stringify(report)).not.toContain("boom");
  });

  it("survives anything thrown: strings, null, objects, hostile names", () => {
    expect(scrubError("a@b.co", {}, {})).toMatchObject({
      errorClass: "string",
      frames: [],
    });
    expect(scrubError(null, {}, {}).errorClass).toBe("object");
    const named = new Error("x");
    named.name = "Anna Rossi <anna.rossi@example.com>";
    expect(scrubError(named, {}, {}).errorClass).toBe("Error");
  });

  it("keeps only a route PATTERN and drops anything else in its place", () => {
    const route = (routePath: unknown) =>
      scrubError(new Error("x"), {}, { routePath }).route;

    expect(route("/[locale]/(site)/work/[slug]")).toBe(
      "/[locale]/(site)/work/[slug]",
    );
    expect(route("/it/contatti?email=anna@example.com")).not.toMatch(/[?=@]/);
    expect(route(undefined)).toBe("unknown");
    expect(route(42)).toBe("unknown");
  });

  it("accepts only a numeric-looking digest and known methods and route types", () => {
    const withDigest = (digest: unknown) =>
      scrubError(Object.assign(new Error("x"), { digest }), {}, {});

    expect(withDigest("anna.rossi@example.com").digest).toBeUndefined();
    expect(withDigest(123).digest).toBeUndefined();
    expect(
      scrubError(new Error("x"), { method: "BREW" }, { routeType: "<script>" }),
    ).toMatchObject({ method: "UNKNOWN", routeType: "unknown" });
  });

  it("caps the number of frames", () => {
    const error = new Error("x");
    error.stack = Array.from(
      { length: 200 },
      (_, i) => `    at fn${String(i)} (file.ts:${String(i + 1)}:1)`,
    ).join("\n");

    expect(scrubError(error, {}, {}).frames).toHaveLength(30);
  });
});
