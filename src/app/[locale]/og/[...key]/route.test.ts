// @vitest-environment node
import { describe, expect, it } from "vitest";

import { GET } from "@/app/[locale]/og/[...key]/route";

const call = (locale: string, key: string[]) =>
  GET(new Request(`http://localhost/${locale}/og/${key.join("/")}`), {
    params: Promise.resolve({ locale, key }),
  });

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function png(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer);
  return {
    signature: [...bytes.slice(0, 8)],
    width: view.getUint32(16),
    height: view.getUint32(20),
    length: bytes.length,
  };
}

describe("the share image route", () => {
  it("renders a 1200x630 PNG for a real page, with a cache that can refresh", async () => {
    const response = await call("it", ["home"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(response.headers.get("cache-control")).toContain(
      "stale-while-revalidate",
    );
    const image = await png(response);
    expect(image.signature).toEqual(PNG);
    expect([image.width, image.height]).toEqual([1200, 630]);
    expect(image.length).toBeGreaterThan(5_000);
  }, 30_000);

  it("renders a service in each language, and the two images differ", async () => {
    const italian = await (
      await call("it", ["services", "ai-agents"])
    ).arrayBuffer();
    const english = await (
      await call("en", ["services", "ai-agents"])
    ).arrayBuffer();

    expect(new Uint8Array(italian).slice(0, 8)).toEqual(new Uint8Array(PNG));
    expect(Buffer.from(italian).equals(Buffer.from(english))).toBe(false);
  }, 30_000);

  it.each([
    ["an unknown language", "fr", ["home"]],
    ["an unknown page", "it", ["nope"]],
    ["an unknown service", "it", ["services", "does-not-exist"]],
    ["a draft work entry", "it", ["work", "business-management-app"]],
    ["a path trick", "it", ["services", "..%2F..%2Fpackage"]],
    ["the confirmation page", "it", ["contact", "thanks"]],
  ])(
    "answers 404 for %s, with no body (negative)",
    async (_name, locale, key) => {
      const response = await call(locale, key);

      expect(response.status).toBe(404);
      expect((await response.arrayBuffer()).byteLength).toBe(0);
    },
  );

  it("ignores a query string: only the path decides what is drawn (negative)", async () => {
    const plain = await (await call("it", ["contact"])).arrayBuffer();
    const forged = await (
      await GET(
        new Request("http://localhost/it/og/contact?title=Free+money&text=x"),
        {
          params: Promise.resolve({ locale: "it", key: ["contact"] }),
        },
      )
    ).arrayBuffer();

    expect(Buffer.from(forged).equals(Buffer.from(plain))).toBe(true);
  }, 30_000);
});
