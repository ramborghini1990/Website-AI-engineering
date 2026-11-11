import { expect, test, type Page, type Request } from "@playwright/test";

import it from "../messages/it.json";
import { interactiveDemos } from "../src/lib/demos/registry";
import { isDemoEvent } from "./support/analytics";
import { prodURL } from "./support/servers";
import { waitForHydration } from "./support/motion";

/**
 * The demo funnel events (P3.5) on the PRODUCTION build with the CSP enforced:
 * cookieless, first party and aggregate. What they must prove is mostly what
 * does NOT happen: nothing on a page view, nothing stored in the browser, no
 * cookie, no third party, nothing at all with Do Not Track on, and an endpoint
 * that refuses anything but `{ event, demo }` from this site.
 */

const ORIGIN = prodURL;
const DEMO_SECTION = "section[aria-labelledby$='-demo-title']";

async function open(page: Page, slug: string) {
  await page.goto(`/it/work/${slug}`);
  await waitForHydration(page);
}

/** Collects the demo events the page sends, and any other non-GET request. */
function watch(page: Page, origin: string) {
  const events: unknown[] = [];
  const others: string[] = [];
  page.on("request", (request: Request) => {
    if (isDemoEvent(request, origin)) {
      events.push(JSON.parse(request.postData() ?? "null"));
    } else if (request.method() !== "GET") {
      others.push(`${request.method()} ${request.url()}`);
    }
  });
  return { events, others };
}

test.describe("demo funnel events", () => {
  test.use({ baseURL: ORIGIN });

  for (const slug of interactiveDemos) {
    test(`${slug}: nothing on a page view, one demo_started on the first click, no cookie or storage`, async ({
      page,
      context,
    }) => {
      const { events, others } = watch(page, ORIGIN);
      await open(page, slug);
      await page.waitForLoadState("networkidle");
      expect(events).toEqual([]);

      const first = page.locator(`${DEMO_SECTION} button:enabled`).first();
      const sent = page.waitForRequest((request) =>
        isDemoEvent(request, ORIGIN),
      );
      await first.click();
      await sent;
      await first.click().catch(() => undefined); // a second click is not a second start
      await page.waitForTimeout(300);

      expect(events).toEqual([{ event: "demo_started", demo: slug }]);
      expect(others).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      expect(
        await page.evaluate(() => localStorage.length + sessionStorage.length),
      ).toBe(0);
    });
  }

  test("the call to action reports cta_clicked and still goes to the form with the service pre-selected", async ({
    page,
  }) => {
    const { events } = watch(page, ORIGIN);
    await open(page, "instagram-lead-agent");

    await page
      .locator(DEMO_SECTION)
      .getByRole("link", { name: it.demos.shell.cta })
      .click();
    await page.waitForURL(/\/it\/contact\?service=ai-agents/);

    expect(events).toEqual([
      { event: "cta_clicked", demo: "instagram-lead-agent" },
    ]);
  });

  test("a finished sale in the back-office demo reports demo_started then demo_completed", async ({
    page,
  }) => {
    const { events } = watch(page, ORIGIN);
    await open(page, "business-management-app");
    const copy = it.demos.business;

    await page
      .getByRole("button", {
        name: copy.pos.addLabel.replace("{name}", copy.items.coffee),
      })
      .click();
    await page.getByRole("button", { name: copy.pos.pay.cash }).click();
    await expect.poll(() => events.length).toBe(2);

    expect(events).toEqual([
      { event: "demo_started", demo: "business-management-app" },
      { event: "demo_completed", demo: "business-management-app" },
    ]);
  });

  test("negative: with Do Not Track on, nothing is sent at all", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "doNotTrack", { value: "1" });
    });
    const { events } = watch(page, ORIGIN);
    await open(page, "instagram-lead-agent");

    await page.locator(`${DEMO_SECTION} button:enabled`).first().click();
    await page
      .locator(DEMO_SECTION)
      .getByRole("link", { name: it.demos.shell.cta })
      .click();
    await page.waitForURL(/\/contact/);

    expect(events).toEqual([]);
  });

  test("negative: the page loads no analytics script and makes no third-party request", async ({
    page,
  }) => {
    const foreign: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== ORIGIN) foreign.push(request.url());
    });
    await open(page, "linkedin-assisted-outreach");
    await page.locator(`${DEMO_SECTION} button:enabled`).first().click();
    await page.waitForLoadState("networkidle");

    expect(foreign).toEqual([]);
    expect(
      await page
        .locator("script[src]")
        .evaluateAll((nodes) =>
          nodes.map((node) => new URL((node as HTMLScriptElement).src).origin),
        ),
    ).toEqual(expect.not.arrayContaining(["https://plausible.io"]));
  });
});

test.describe("POST /api/demo-events", () => {
  test.use({ baseURL: ORIGIN });
  const url = "/api/demo-events";
  const good = { event: "demo_started", demo: "instagram-lead-agent" };
  // Each test uses its own address, so the shared limiter never makes them depend on each other.
  const as = (ip: string) => ({ "x-real-ip": ip, origin: ORIGIN });

  test("accepts exactly { event, demo } from this site: 204, no body, no cookie", async ({
    request,
  }) => {
    const response = await request.post(url, {
      data: good,
      headers: as("198.51.100.21"),
    });

    expect(response.status()).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers()["set-cookie"]).toBeUndefined();
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("negative: an extra field, an unknown demo or event is refused (400)", async ({
    request,
  }) => {
    for (const data of [
      { ...good, visitorId: "abc" },
      { ...good, demo: "somewhere-else" },
      { ...good, event: "page_view" },
    ]) {
      const response = await request.post(url, {
        data,
        headers: as("198.51.100.22"),
      });
      expect(response.status()).toBe(400);
    }
  });

  test("negative: another site's origin is refused (403)", async ({
    request,
  }) => {
    const response = await request.post(url, {
      data: good,
      headers: { "x-real-ip": "198.51.100.23", origin: "https://evil.example" },
    });

    expect(response.status()).toBe(403);
  });

  test("negative: GET is not allowed", async ({ request }) => {
    expect((await request.get(url)).status()).toBe(405);
  });
});
