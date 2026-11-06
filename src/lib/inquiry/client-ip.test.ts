// @vitest-environment node
import { describe, expect, it } from "vitest";

import { clientIp } from "@/lib/inquiry/client-ip";

const headers = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("prefers x-real-ip", () => {
    expect(
      clientIp(
        headers({
          "x-real-ip": "203.0.113.5",
          "x-forwarded-for": "198.51.100.9",
        }),
      ),
    ).toBe("203.0.113.5");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    expect(
      clientIp(
        headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1, 10.0.0.2" }),
      ),
    ).toBe("198.51.100.9");
  });

  it("accepts IPv6", () => {
    expect(clientIp(headers({ "x-real-ip": "2001:db8::1" }))).toBe(
      "2001:db8::1",
    );
  });

  it("is `unknown` when there is no header", () => {
    expect(clientIp(headers({}))).toBe("unknown");
  });

  it.each([
    ["markup", "<script>alert(1)</script>"],
    ["a very long value", "1".repeat(200)],
    ["a hostname", "evil.example.com"],
    ["a quote-laden value", "1.2.3.4'; DROP TABLE"],
  ])("treats %s as `unknown`, one shared bucket (negative)", (_name, value) => {
    expect(clientIp(headers({ "x-real-ip": value }))).toBe("unknown");
  });
});
