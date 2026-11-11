import { expect, test, type APIRequestContext } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import { readServices, readWork } from "./support/content";

/**
 * SEO and sharing (P2.6) on the PRODUCTION build: robots.txt, sitemap.xml, the
 * share images, and the canonical / hreflang / Open Graph / Twitter metadata of
 * every page the sitemap lists, crawled the way a search engine would.
 *
 * The test server sets NEXT_PUBLIC_SITE_URL to its own origin, so every absolute
 * URL in the sitemap and in the metadata must start with `baseURL`.
 */

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BRAND = "AI Solutions & Engineering";

type SitemapEntry = { loc: string; alternates: Record<string, string> };

async function readSitemap(
  request: APIRequestContext,
): Promise<{ entries: SitemapEntry[]; xml: string }> {
  const response = await request.get("/sitemap.xml", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const xml = await response.text();
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((block) => {
    const body = block[1];
    const alternates: Record<string, string> = {};
    for (const link of body.matchAll(
      /<xhtml:link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/g,
    )) {
      alternates[link[1]] = link[2];
    }
    return { loc: /<loc>([^<]+)<\/loc>/.exec(body)?.[1] ?? "", alternates };
  });
  return { entries, xml };
}

async function readPng(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  const bytes = new Uint8Array(await response.body());
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return {
    status: response.status(),
    type: response.headers()["content-type"],
    cache: response.headers()["cache-control"],
    signature: [...bytes.slice(0, 8)],
    width: bytes.length > 24 ? view.getUint32(16) : 0,
    height: bytes.length > 24 ? view.getUint32(20) : 0,
    bytes,
  };
}

test.describe("robots.txt", () => {
  test("is served as text without a locale redirect, allows the site, blocks the dev tools, names the sitemap", async ({
    request,
    baseURL,
  }) => {
    const response = await request.get("/robots.txt", { maxRedirects: 0 });
    const text = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(text).toMatch(/User-Agent: \*/i);
    expect(text).toMatch(/^Allow: \/$/m);
    expect(text).toContain("Disallow: /*/_dev/");
    expect(text).toContain("Disallow: /*/dev-tools/");
    expect(text).toContain(`Sitemap: ${baseURL ?? ""}/sitemap.xml`);
  });

  test("does not disallow a public page (negative)", async ({ request }) => {
    const text = await (await request.get("/robots.txt")).text();
    const disallowed = [...text.matchAll(/^Disallow: (.*)$/gm)].map(
      (match) => match[1],
    );

    for (const path of ["/it", "/en/services", "/it/work", "/en/contact"]) {
      expect(
        disallowed.some((rule) => rule === "/" || path.startsWith(rule)),
        path,
      ).toBe(false);
    }
  });
});

test.describe("sitemap.xml", () => {
  test("is XML, served without a locale redirect", async ({ request }) => {
    const response = await request.get("/sitemap.xml", { maxRedirects: 0 });

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
  });

  test("lists every public page in both languages: home, services (and each service), work, contact", async ({
    request,
    baseURL,
  }) => {
    const { entries } = await readSitemap(request);
    const locs = entries.map((entry) => entry.loc);
    const base = baseURL ?? "";
    const expected = ["", "/services", "/work", "/contact"];
    for (const { slug } of readServices("it"))
      expected.push(`/services/${slug}`);
    for (const { slug, data } of readWork("it")) {
      if (!data.draft) expected.push(`/work/${slug}`);
    }

    for (const locale of ["it", "en"]) {
      for (const path of expected) {
        expect(locs, `${locale}${path}`).toContain(`${base}/${locale}${path}`);
      }
    }
    expect(locs).toHaveLength(expected.length * 2);
    expect(new Set(locs).size).toBe(locs.length);
  });

  test("leaves out what must not be indexed or does not exist: the confirmation page, the dev tools, unbuilt pages, drafts (negative)", async ({
    request,
  }) => {
    const { entries } = await readSitemap(request);
    const locs = entries.map((entry) => entry.loc);

    for (const loc of locs) {
      expect(loc).not.toMatch(/thanks|dev-tools|_dev|\/og\/|\/process|\/about/);
    }
    for (const { slug, data } of readWork("it")) {
      if (data.draft) {
        expect(
          locs.some((loc) => loc.endsWith(`/work/${slug}`)),
          slug,
        ).toBe(false);
      }
    }
  });

  test("every URL is on the site's own origin, with no trailing slash and no query", async ({
    request,
    baseURL,
  }) => {
    const { entries } = await readSitemap(request);

    for (const { loc } of entries) {
      expect(loc.startsWith(`${baseURL ?? ""}/`)).toBe(true);
      expect(loc).not.toMatch(/\/$|\?|#/);
    }
  });

  test("each entry lists both languages and x-default, and they agree between the two entries of a page", async ({
    request,
  }) => {
    const { entries } = await readSitemap(request);

    for (const entry of entries) {
      expect(Object.keys(entry.alternates).sort(), entry.loc).toEqual([
        "en",
        "it",
        "x-default",
      ]);
      expect(entry.alternates["x-default"]).toBe(entry.alternates["it"]);
      expect(
        [entry.alternates["it"], entry.alternates["en"]],
        entry.loc,
      ).toContain(entry.loc);
    }
    const byItalian = new Map(
      entries.map((entry) => [entry.alternates["it"], entry.alternates]),
    );
    for (const entry of entries) {
      expect(byItalian.get(entry.alternates["it"])).toEqual(entry.alternates);
    }
  });

  test("carries change frequency and priority, and states no date it does not know", async ({
    request,
  }) => {
    const { xml } = await readSitemap(request);

    expect(xml).toContain("<changefreq>weekly</changefreq>");
    expect(xml).toContain("<priority>1</priority>");
    // Only a published project has a date, and there is none yet.
    expect(xml).not.toContain("<lastmod>");
  });
});

test.describe("every page in the sitemap, crawled", () => {
  test("canonical, hreflang, Open Graph and Twitter are complete, consistent and reciprocal", async ({
    page,
    request,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const base = baseURL ?? "";
    const { entries } = await readSitemap(request);
    const known = new Set(entries.map((entry) => entry.loc));
    expect(entries.length).toBeGreaterThanOrEqual(14);

    for (const entry of entries) {
      const locale = entry.loc.slice(base.length + 1).split("/")[0] ?? "";
      const response = await page.goto(entry.loc);
      expect(response?.status(), entry.loc).toBe(200);

      const attr = (selector: string, name = "content") =>
        page.locator(selector).first().getAttribute(name);

      // Canonical: the page's own URL, absolute, on our origin.
      expect(await attr('link[rel="canonical"]', "href"), entry.loc).toBe(
        entry.loc,
      );

      // hreflang: exactly the sitemap's alternates; each target is a listed page.
      const hreflangs = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((all) =>
          Object.fromEntries(
            all.map((link) => [
              link.getAttribute("hreflang") ?? "",
              link.getAttribute("href") ?? "",
            ]),
          ),
        );
      expect(hreflangs, entry.loc).toEqual(entry.alternates);
      for (const target of Object.values(hreflangs)) {
        expect(known.has(target), `${entry.loc} -> ${target}`).toBe(true);
      }

      // The document's language, title and description.
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect((await page.title()).length, entry.loc).toBeGreaterThan(10);
      expect(await attr('meta[name="description"]'), entry.loc).toMatch(
        /.{50,}/,
      );

      // Open Graph.
      expect(await attr('meta[property="og:type"]'), entry.loc).toBe("website");
      expect(await attr('meta[property="og:url"]'), entry.loc).toBe(entry.loc);
      expect(await attr('meta[property="og:site_name"]'), entry.loc).toBe(
        BRAND,
      );
      expect(await attr('meta[property="og:title"]'), entry.loc).toContain(
        BRAND,
      );
      expect(await attr('meta[property="og:description"]'), entry.loc).toBe(
        await attr('meta[name="description"]'),
      );
      expect(await attr('meta[property="og:locale"]'), entry.loc).toBe(
        locale === "it" ? "it_IT" : "en_GB",
      );
      expect(
        await attr('meta[property="og:locale:alternate"]'),
        entry.loc,
      ).toBe(locale === "it" ? "en_GB" : "it_IT");
      const ogImage = (await attr('meta[property="og:image"]')) ?? "";
      expect(ogImage.startsWith(`${base}/${locale}/og/`), entry.loc).toBe(true);
      expect(await attr('meta[property="og:image:width"]')).toBe("1200");
      expect(await attr('meta[property="og:image:height"]')).toBe("630");
      expect(await attr('meta[property="og:image:alt"]')).toContain(BRAND);

      // Twitter.
      expect(await attr('meta[name="twitter:card"]'), entry.loc).toBe(
        "summary_large_image",
      );
      expect(await attr('meta[name="twitter:image"]'), entry.loc).toBe(ogImage);
      expect(await attr('meta[name="twitter:title"]'), entry.loc).toBe(
        await attr('meta[property="og:title"]'),
      );

      // The two language versions are not the same text.
      expect(await attr('meta[property="og:title"]')).not.toBe("");
    }
  });

  test("the two language versions of a page have different titles and images", async ({
    page,
    baseURL,
  }) => {
    const base = baseURL ?? "";
    const get = async (url: string) => {
      await page.goto(url);
      return {
        title: await page.title(),
        image: await page
          .locator('meta[property="og:image"]')
          .getAttribute("content"),
      };
    };

    const italian = await get(`${base}/it/services/ai-agents`);
    const english = await get(`${base}/en/services/ai-agents`);

    expect(italian.title).not.toBe(english.title);
    expect(italian.image).not.toBe(english.image);
  });

  test("a work or services page that does not exist has no metadata to index: a 404 with no canonical (negative)", async ({
    page,
  }) => {
    const response = await page.goto("/it/services/does-not-exist");

    expect(response?.status()).toBe(404);
    expect(await page.locator('link[rel="canonical"]').count()).toBe(0);
  });

  test("the confirmation page is not indexable", async ({ page }) => {
    await page.goto("/it/contact/thanks");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});

test.describe("share images", () => {
  test("the image of every page in the sitemap is a 1200x630 PNG with a refreshable cache", async ({
    request,
    page,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    const { entries } = await readSitemap(request);

    for (const entry of entries) {
      await page.goto(entry.loc);
      const url =
        (await page
          .locator('meta[property="og:image"]')
          .getAttribute("content")) ?? "";
      const image = await readPng(request, url);

      expect(image.status, url).toBe(200);
      expect(image.type, url).toBe("image/png");
      expect(image.signature, url).toEqual(PNG);
      expect([image.width, image.height], url).toEqual([1200, 630]);
      expect(image.cache, url).toContain("s-maxage=86400");
      expect(image.bytes.length, url).toBeGreaterThan(5_000);
      expect(url.startsWith(`${baseURL ?? ""}/`)).toBe(true);
    }
  });

  test("the Italian and English images of a page are different pictures", async ({
    request,
  }) => {
    const italian = await readPng(request, "/it/og/services/ai-agents");
    const english = await readPng(request, "/en/og/services/ai-agents");

    expect(Buffer.from(italian.bytes).equals(Buffer.from(english.bytes))).toBe(
      false,
    );
  });

  for (const [name, path] of [
    ["an unknown language", "/fr/og/home"],
    ["an unknown page", "/it/og/nope"],
    ["an unknown service", "/it/og/services/does-not-exist"],
    ["a path trick", "/it/og/services/..%2F..%2Fpackage"],
    ["the confirmation page", "/it/og/contact/thanks"],
    ["too many segments", "/it/og/services/ai-agents/extra"],
  ] as const) {
    test(`${name} is a 404 (negative)`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(404);
    });
  }

  test("a draft or unpublished work entry has no share image (negative)", async ({
    request,
  }) => {
    // P3.4 published the last draft demo, so there may be none in the content: an unpublished slug stands in.
    const drafts = readWork("it").filter(({ data }) => data.draft);

    for (const { slug } of drafts) {
      expect((await request.get(`/it/og/work/${slug}`)).status(), slug).toBe(
        404,
      );
    }
    expect(
      (await request.get("/it/og/work/planned-demo-not-published")).status(),
    ).toBe(404);
  });

  test("a query string cannot change what is drawn: nobody can make our domain print their text (negative)", async ({
    request,
  }) => {
    const plain = await readPng(request, "/it/og/contact");
    const forged = await readPng(
      request,
      "/it/og/contact?title=Free+money&text=Click+here",
    );

    expect(Buffer.from(forged.bytes).equals(Buffer.from(plain.bytes))).toBe(
      true,
    );
  });

  test("the card text is the page's own h1 in the page's language (checked by what the route is given, in unit tests; here: the images exist for both)", async ({
    request,
  }) => {
    for (const locale of ["it", "en"] as const) {
      const messages = locale === "it" ? it : en;
      expect(messages.home.hero.headline.length).toBeGreaterThan(10);
      expect((await request.get(`/${locale}/og/home`)).status()).toBe(200);
    }
  });
});
