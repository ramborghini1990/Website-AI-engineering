import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import en from "../messages/en.json";
import it from "../messages/it.json";
import {
  layoutShift,
  settleAnimations,
  trackLayoutShift,
  waitForHydration,
} from "./support/motion";

/**
 * The back-office demo (P3.4) on the PRODUCTION build with the CSP enforced: a
 * till, a cash-flow dashboard and purchase orders on invented data kept in the
 * browser's own IndexedDB. The tests prove what that promises: the numbers
 * move together (a sale changes stock, takings and balance; receiving an order
 * changes stock and cash), nothing can be typed, the data survives a reload and
 * "Start over" erases it, nothing goes to a server, the charts have a table
 * fallback, and the page is accessible and responsive.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const SLUG = "business-management-app";
const DB_NAME = "demo-business-suite";

type Locale = (typeof LOCALES)[number];
type Product = keyof typeof en.demos.business.items;

const copy = (locale: Locale) => messages[locale].demos.business;
const shellCopy = (locale: Locale) => messages[locale].demos.shell;

/** An amount as the page writes it, as a pattern that accepts any kind of space (the no-break one included). */
const money = (cents: number, locale: Locale) =>
  new RegExp(
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })
      .format(cents / 100)
      .replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
      .replaceAll(/\s/g, String.raw`\s`),
  );

async function open(page: Page, locale: Locale) {
  await page.goto(`/${locale}/work/${SLUG}`);
  await waitForHydration(page);
  await settleAnimations(page);
  // The saved changes are loaded right after hydration: wait for that before acting.
  await expect(
    demo(page, locale).locator("[data-storage]"),
  ).not.toHaveAttribute("data-storage", "checking");
}

const demo = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: shellCopy(locale).title });
const status = (page: Page, locale: Locale) =>
  demo(page, locale).getByRole("status");
const tab = (page: Page, locale: Locale, name: "pos" | "cashflow" | "orders") =>
  demo(page, locale)
    .getByRole("button", { name: copy(locale).tabs[name], exact: true })
    .click();
const product = (page: Page, id: Product) =>
  page.locator(`[data-product="${id}"]`);
const add = (page: Page, locale: Locale, id: Product) =>
  demo(page, locale)
    .getByRole("button", {
      name: copy(locale).pos.addLabel.replace("{name}", copy(locale).items[id]),
    })
    .click();
const pay = (page: Page, locale: Locale, method: "cash" | "card") =>
  demo(page, locale)
    .getByRole("button", { name: copy(locale).pos.pay[method] })
    .click();
const kpi = (page: Page, key: "balance" | "in" | "out" | "open") =>
  page.locator(`[data-kpi="${key}"] dd`);
const start = (page: Page) =>
  page.getByRole("button", { name: it.demos.shell.reset });

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

async function storedDatabases(page: Page) {
  return page.evaluate(async () =>
    (await indexedDB.databases()).map((db) => db.name),
  );
}

/** What the demo has saved in its IndexedDB, or undefined when nothing is saved. */
async function storedSales(page: Page) {
  return page.evaluate(
    (name) =>
      new Promise<number | undefined>((resolve) => {
        const open = indexedDB.open(name);
        open.onerror = () => {
          resolve(undefined);
        };
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("state")) {
            db.close();
            resolve(undefined);
            return;
          }
          const read = db
            .transaction("state", "readonly")
            .objectStore("state")
            .get("data");
          read.onsuccess = () => {
            const value = read.result as { sales: unknown[] } | undefined;
            db.close();
            resolve(value?.sales.length);
          };
          read.onerror = () => {
            db.close();
            resolve(undefined);
          };
        };
      }),
    DB_NAME,
  );
}

test.describe("the page", () => {
  for (const locale of LOCALES) {
    const c = copy(locale);

    test(`/${locale}: h1, a Simulation badge, the disclosure, the limits, the three sections and the eight products`, async ({
      page,
    }) => {
      const response = await page.goto(`/${locale}/work/${SLUG}`);

      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        demo(page, locale).getByText(shellCopy(locale).badge, { exact: true }),
      ).toBeVisible();
      await expect(
        demo(page, locale).locator("[data-demo-disclosure]"),
      ).toContainText(c.disclosure);
      const limits = demo(page, locale).locator("[data-limits]");
      for (const key of ["local", "synthetic", "rules", "scope"] as const) {
        await expect(limits).toContainText(c.limits[key]);
      }
      for (const name of ["pos", "cashflow", "orders"] as const) {
        await expect(
          demo(page, locale).getByRole("button", {
            name: c.tabs[name],
            exact: true,
          }),
        ).toBeVisible();
      }
      await expect(page.locator("[data-product]")).toHaveCount(8);
    });

    test(`/${locale}: the disclosure, the limits and the till are in the HTML, in that order`, async ({
      request,
    }) => {
      const html = await (await request.get(`/${locale}/work/${SLUG}`)).text();

      const disclosureAt = html.indexOf(c.disclosure.slice(0, 40));
      const limitsAt = html.indexOf(c.limits.local.slice(0, 30));
      const tillAt = html.indexOf('data-product="coffee"');
      expect(disclosureAt).toBeGreaterThan(-1);
      expect(limitsAt).toBeGreaterThan(disclosureAt);
      expect(tillAt).toBeGreaterThan(limitsAt);
    });
  }
});

test.describe("the till", () => {
  test("a sale lowers the stock, is announced, empties the cart and is the newest sale in the list", async ({
    page,
  }) => {
    const c = copy("en");
    await open(page, "en");
    await expect(product(page, "coffee")).toContainText("12 in stock");

    await add(page, "en", "coffee");
    await add(page, "en", "coffee");
    await add(page, "en", "pasta");
    await expect(page.locator("[data-cart-total]")).toHaveText(
      money(2 * 549 + 189, "en"),
    );
    await pay(page, "en", "card");

    await expect(status(page, "en")).toContainText(
      c.notice.sale.split("{")[0] ?? "",
    );
    await expect(status(page, "en")).toContainText(money(2 * 549 + 189, "en"));
    await expect(page.locator("[data-cart-empty]")).toBeVisible();
    await expect(product(page, "coffee")).toContainText("10 in stock");
    await expect(product(page, "pasta")).toContainText("63 in stock");
    const newest = page.locator("[data-recent-sales] tbody tr").first();
    await expect(newest).toContainText(c.pos.recent.card);
    await expect(newest).toContainText(money(2 * 549 + 189, "en"));
  });

  test("the shelf is the limit: when the last coffee is in the sale, 'Add' is off and 'one more' is refused with a notice (negative)", async ({
    page,
  }) => {
    const c = copy("en");
    await open(page, "en");

    for (let i = 0; i < 12; i += 1) await add(page, "en", "coffee");

    await expect(
      demo(page, "en").getByRole("button", {
        name: c.pos.addLabel.replace("{name}", c.items.coffee),
      }),
    ).toBeDisabled();
    await demo(page, "en")
      .getByRole("button", {
        name: c.pos.cart.more.replace("{name}", c.items.coffee),
      })
      .click();
    await expect(status(page, "en")).toHaveText(
      c.notice.limit.replace("{name}", c.items.coffee),
    );
    await expect(page.locator("[data-qty]")).toHaveText("12");
  });

  test("with nothing in the sale the payment buttons are off (negative)", async ({
    page,
  }) => {
    await open(page, "it");

    await expect(
      demo(page, "it").getByRole("button", { name: copy("it").pos.pay.cash }),
    ).toBeDisabled();
    await expect(
      demo(page, "it").getByRole("button", { name: copy("it").pos.pay.card }),
    ).toBeDisabled();
  });

  test("there is no text box, file input or editable region anywhere, in any section (negative)", async ({
    page,
  }) => {
    await open(page, "it");
    const surface = () =>
      demo(page, "it")
        .locator(
          "textarea, input, select, [contenteditable='true'], [type='file']",
        )
        .count();

    for (const name of ["pos", "cashflow", "orders"] as const) {
      await tab(page, "it", name);
      expect(await surface()).toBe(0);
      expect(await demo(page, "it").getByRole("textbox").count()).toBe(0);
    }
  });
});

test.describe("the cash-flow dashboard", () => {
  test("a sale moves the balance and the money in by exactly its total; the table agrees with the figure", async ({
    page,
  }) => {
    await open(page, "en");
    await tab(page, "en", "cashflow");
    const balanceBefore = await kpi(page, "balance").innerText();
    const inBefore = await kpi(page, "in").innerText();

    await tab(page, "en", "pos");
    await add(page, "en", "oil");
    await pay(page, "en", "cash");
    await tab(page, "en", "cashflow");

    await expect(kpi(page, "balance")).not.toHaveText(balanceBefore);
    await expect(kpi(page, "in")).not.toHaveText(inBefore);
    await page.locator('[data-table="balance"] summary').click();
    const rows = page.locator('[data-table="balance"] tbody tr');
    await expect(rows).toHaveCount(30);
    const lastBalance = await rows.last().locator("td").innerText();
    const kpiBalance = await kpi(page, "balance").innerText();
    expect(lastBalance.replaceAll(/\s/g, " ")).toBe(
      kpiBalance.replaceAll(/\s/g, " "),
    );
  });

  test("each chart is an image with a title and a description, and its figures are in a real table (accessibility)", async ({
    page,
  }) => {
    const c = copy("en");
    await open(page, "en");
    await tab(page, "en", "cashflow");

    const charts = demo(page, "en").getByRole("img");
    await expect(charts).toHaveCount(2);
    await expect(charts.nth(0)).toHaveAccessibleName(
      new RegExp(`^${c.cash.balance.title}`),
    );
    await expect(charts.nth(1)).toHaveAccessibleName(
      new RegExp(`^${c.cash.flow.title}`),
    );
    await expect(charts.nth(0)).toHaveAccessibleDescription(/lowest point was/);
    await expect(charts.nth(1)).toHaveAccessibleDescription(
      /In the latest week/,
    );
    // Closed by default; one click on the summary opens it, and it is a table with headers.
    const flow = page.locator('[data-table="flow"]');
    await expect(flow.locator("table")).toBeHidden();
    await flow.locator("summary").click();
    await expect(flow.locator("table")).toBeVisible();
    await expect(flow.getByRole("columnheader")).toHaveCount(4);
    await expect(flow.locator("tbody tr")).toHaveCount(8);
    await expect(flow.getByRole("table")).toHaveAccessibleName(
      c.cash.table.flowCaption,
    );
  });

  test("the charts are drawn in the theme's colours: the line is the accent, in both themes", async ({
    page,
  }) => {
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "en");
      await tab(page, "en", "cashflow");

      const stroke = await demo(page, "en")
        .locator("polyline")
        .evaluate((node) => getComputedStyle(node).stroke);
      const accent = await page.evaluate(() => {
        const probe = document.createElement("i");
        probe.style.color = "var(--color-accent)";
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      });
      expect(stroke).toBe(accent);
    }
  });
});

test.describe("purchase orders", () => {
  test("a reorder goes draft, sent, received; only receiving it raises the shelf and takes the money", async ({
    page,
  }) => {
    const c = copy("en");
    await open(page, "en");
    await tab(page, "en", "cashflow");
    const cashBefore = await kpi(page, "balance").innerText();
    await tab(page, "en", "orders");
    const tea = page.locator('[data-stock-row="tea"]');
    await expect(tea.locator("[data-shelf]")).toHaveText("8");
    await expect(tea.locator("[data-state]")).toHaveText(c.orders.stock.low);

    await demo(page, "en")
      .getByRole("button", {
        name: c.orders.reorder.createLabel.replace(
          "{supplier}",
          c.suppliers.verde,
        ),
      })
      .click();
    const order = page.locator('[data-order="PO-0005"]');
    await expect(order).toHaveAttribute("data-status", "draft");
    await expect(order).toContainText(`30 × ${c.items.tea}`);
    await expect(tea.locator("[data-state]")).toHaveText(
      c.orders.stock.onOrder,
    );
    await expect(tea.locator("[data-shelf]")).toHaveText("8");

    await demo(page, "en")
      .getByRole("button", {
        name: c.orders.list.sendLabel.replace("{id}", "PO-0005"),
      })
      .click();
    await expect(order).toHaveAttribute("data-status", "sent");
    await expect(tea.locator("[data-shelf]")).toHaveText("8");
    await tab(page, "en", "cashflow");
    await expect(kpi(page, "balance")).toHaveText(cashBefore);
    await tab(page, "en", "orders");

    await demo(page, "en")
      .getByRole("button", {
        name: c.orders.list.receiveLabel.replace("{id}", "PO-0005"),
      })
      .click();
    await expect(order).toHaveAttribute("data-status", "received");
    await expect(tea.locator("[data-shelf]")).toHaveText("38");
    await expect(status(page, "en")).toHaveText(
      c.notice.orderReceived.replace("{id}", "PO-0005"),
    );
    await tab(page, "en", "cashflow");
    await expect(kpi(page, "balance")).not.toHaveText(cashBefore);
  });

  test("a draft has no 'Receive' and a received order has no button at all (negative)", async ({
    page,
  }) => {
    const c = copy("en");
    await open(page, "en");
    await tab(page, "en", "orders");

    await expect(
      demo(page, "en").getByRole("button", {
        name: c.orders.list.receiveLabel.replace("{id}", "PO-0004"),
      }),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-order="PO-0001"]').getByRole("button"),
    ).toHaveCount(0);
    await expect(
      demo(page, "en").getByRole("button", {
        name: c.orders.reorder.createLabel.replace(
          "{supplier}",
          c.suppliers.alpina,
        ),
      }),
    ).toBeDisabled();
  });
});

test.describe("what is kept in the browser", () => {
  test("a sale survives a reload and sits in this browser's IndexedDB; a fresh browser context starts from the sample", async ({
    page,
    browser,
    baseURL,
  }) => {
    await open(page, "en");
    expect(await storedSales(page)).toBeUndefined();
    await add(page, "en", "tea");
    await pay(page, "en", "cash");
    await expect.poll(() => storedSales(page)).toBeGreaterThan(200);

    await open(page, "en");

    await expect(product(page, "tea")).toContainText("7 in stock");
    await expect(
      demo(page, "en").locator('[data-storage="saved"]'),
    ).toContainText(copy("en").storage.saved);
    expect(await storedDatabases(page)).toEqual([DB_NAME]);

    // Another browser profile has its own storage: it knows nothing of this change.
    const other = await browser.newContext({ baseURL });
    const otherPage = await other.newPage();
    await open(otherPage, "en");
    await expect(product(otherPage, "tea")).toContainText("8 in stock");
    await other.close();
  });

  test("'Start over' restores the sample data and erases what was saved, for good", async ({
    page,
  }) => {
    await open(page, "it");
    await add(page, "it", "tea");
    await pay(page, "it", "card");
    await expect.poll(() => storedSales(page)).toBeGreaterThan(200);
    await tab(page, "it", "orders");
    await demo(page, "it")
      .getByRole("button", {
        name: copy("it").orders.reorder.createLabel.replace(
          "{supplier}",
          copy("it").suppliers.rossi,
        ),
      })
      .click();

    await start(page).click();

    await expect(status(page, "it")).toHaveText(copy("it").notice.reset);
    await expect(page.locator('[data-order="PO-0005"]')).toHaveCount(0);
    await tab(page, "it", "pos");
    await expect(product(page, "tea")).toContainText("8 in magazzino");
    await expect.poll(() => storedSales(page)).toBeUndefined();
    await open(page, "it");
    await expect(product(page, "tea")).toContainText("8 in magazzino");
  });

  test("a tampered save is ignored: the sample data shows instead (negative)", async ({
    page,
  }) => {
    await open(page, "en");
    await add(page, "en", "tea");
    await pay(page, "en", "cash");
    await expect.poll(() => storedSales(page)).toBeGreaterThan(200);
    await page.evaluate(
      (name) =>
        new Promise<void>((resolve) => {
          const open = indexedDB.open(name);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction("state", "readwrite");
            tx.objectStore("state").put(
              { version: 1, stock: { tea: -999 }, admin: true },
              "data",
            );
            tx.oncomplete = () => {
              db.close();
              resolve();
            };
          };
        }),
      DB_NAME,
    );

    await open(page, "en");

    await expect(product(page, "tea")).toContainText("8 in stock");
    await expect(page.locator("[data-product]")).toHaveCount(8);
  });

  test("when the browser refuses IndexedDB the demo still works and says so", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "indexedDB", {
        configurable: true,
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      });
    });
    await page.goto("/en/work/" + SLUG);
    await waitForHydration(page);

    await expect(
      demo(page, "en").locator('[data-storage="unavailable"]'),
    ).toContainText(copy("en").storage.unavailable);
    await add(page, "en", "soap");
    await pay(page, "en", "cash");
    await expect(product(page, "soap")).toContainText("27 in stock");
  });
});

test.describe("zero network, strict CSP, nothing else stored", () => {
  test("a whole session over the three sections makes no request anywhere else, sends nothing, sets no cookie, and the CSP is never violated", async ({
    page,
    baseURL,
  }) => {
    const c = copy("it");
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const offenders: string[] = [];
    const errors: string[] = [];
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener("securitypolicyviolation", (event) => {
        w.__csp.push(`${event.violatedDirective} <- ${event.blockedURI}`);
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    await open(page, "it");
    await page.waitForLoadState("networkidle");
    // From here on, only the visitor's actions: nothing may leave the page.
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== origin) offenders.push(`foreign ${request.url()}`);
      if (request.method() !== "GET")
        offenders.push(`${request.method()} ${request.url()}`);
      if (url.pathname.startsWith("/api"))
        offenders.push(`api ${request.url()}`);
    });

    await add(page, "it", "coffee");
    await add(page, "it", "rice");
    await pay(page, "it", "card");
    await tab(page, "it", "cashflow");
    await page.locator('[data-table="balance"] summary').click();
    await tab(page, "it", "orders");
    await demo(page, "it")
      .getByRole("button", {
        name: c.orders.reorder.createLabel.replace(
          "{supplier}",
          c.suppliers.verde,
        ),
      })
      .click();
    await demo(page, "it")
      .getByRole("button", {
        name: c.orders.list.sendLabel.replace("{id}", "PO-0005"),
      })
      .click();
    await demo(page, "it")
      .getByRole("button", {
        name: c.orders.list.receiveLabel.replace("{id}", "PO-0005"),
      })
      .click();
    await start(page).click();
    await page.waitForTimeout(300);

    expect(offenders).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as unknown as { __csp: string[] }).__csp,
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
    ).toBe(0);
    expect(await page.evaluate(() => document.cookie)).toBe("");
  });

  test("the page loads nothing from any third party", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const foreign: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).origin !== origin) {
        foreign.push(request.url());
      }
    });

    await open(page, "en");
    await tab(page, "en", "cashflow");
    await page.waitForLoadState("networkidle");

    expect(foreign).toEqual([]);
  });
});

test.describe("the call to action into the funnel", () => {
  for (const locale of LOCALES) {
    test(`${locale}: it goes to the contact page with web applications pre-selected`, async ({
      page,
    }) => {
      await open(page, locale);

      const link = demo(page, locale).getByRole("link", {
        name: shellCopy(locale).cta,
      });
      await expect(link).toHaveAttribute(
        "href",
        `/${locale}/contact?service=web-applications`,
      );
      await link.click();

      await expect(page).toHaveURL(
        new RegExp(`/${locale}/contact\\?service=web-applications$`),
      );
      await waitForHydration(page);
      const f = messages[locale].contact.form;
      await expect(
        page.getByRole("radio", { name: f.need.options["web-application"] }),
      ).toBeChecked();
      await expect(page.getByLabel(f.need.descriptionLabel)).toHaveValue("");
    });
  }

  test("the demo's own call to action says what this demo is for", async ({
    page,
  }) => {
    await open(page, "it");

    await expect(
      demo(page, "it").getByRole("heading", { name: copy("it").ctaTitle }),
    ).toBeVisible();
  });

  test("the page's closing call to action also pre-selects the service", async ({
    page,
  }) => {
    await open(page, "it");

    await expect(
      page
        .getByRole("region", { name: messages.it.work.cta.title })
        .getByRole("link", { name: messages.it.work.cta.cta }),
    ).toHaveAttribute("href", "/it/contact?service=web-applications");
  });
});

test.describe("keyboard", () => {
  test("the whole flow works with the keyboard: add, pay, open a table, reorder, send, receive", async ({
    page,
  }) => {
    const c = copy("en");
    await open(page, "en");

    await demo(page, "en")
      .getByRole("button", {
        name: c.pos.addLabel.replace("{name}", c.items.oil),
      })
      .focus();
    await page.keyboard.press("Enter");
    await demo(page, "en")
      .getByRole("button", { name: c.pos.pay.cash })
      .focus();
    await page.keyboard.press("Space");
    await expect(status(page, "en")).toContainText(money(899, "en"));

    await demo(page, "en")
      .getByRole("button", { name: c.tabs.cashflow, exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await page.locator('[data-table="flow"] summary').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-table="flow"] table')).toBeVisible();

    await demo(page, "en")
      .getByRole("button", { name: c.tabs.orders, exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await demo(page, "en")
      .getByRole("button", {
        name: c.orders.reorder.createLabel.replace(
          "{supplier}",
          c.suppliers.rossi,
        ),
      })
      .focus();
    await page.keyboard.press("Enter");
    await demo(page, "en")
      .getByRole("button", {
        name: c.orders.list.sendLabel.replace("{id}", "PO-0005"),
      })
      .focus();
    await page.keyboard.press("Enter");
    await demo(page, "en")
      .getByRole("button", {
        name: c.orders.list.receiveLabel.replace("{id}", "PO-0005"),
      })
      .focus();
    await page.keyboard.press("Enter");

    await expect(page.locator('[data-order="PO-0005"]')).toHaveAttribute(
      "data-status",
      "received",
    );
  });

  test("the section buttons say which one is showing", async ({ page }) => {
    await open(page, "en");

    await expect(
      demo(page, "en").getByRole("button", {
        name: copy("en").tabs.pos,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await tab(page, "en", "orders");
    await expect(
      demo(page, "en").getByRole("button", {
        name: copy("en").tabs.orders,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      demo(page, "en").getByRole("button", {
        name: copy("en").tabs.pos,
        exact: true,
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`${locale} (${scheme}): till, sale rung up, dashboard with both tables open, orders: zero violations`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, locale);
        await expectNoAxeViolations(page);

        await add(page, locale, "coffee");
        await expectNoAxeViolations(page);
        await pay(page, locale, "card");
        await expectNoAxeViolations(page);

        await tab(page, locale, "cashflow");
        await expectNoAxeViolations(page);
        for (const which of ["balance", "flow"]) {
          await page.locator(`[data-table="${which}"] summary`).click();
        }
        await expectNoAxeViolations(page);

        await tab(page, locale, "orders");
        await expectNoAxeViolations(page);
        await demo(page, locale)
          .getByRole("button", {
            name: copy(locale).orders.reorder.createLabel.replace(
              "{supplier}",
              copy(locale).suppliers.verde,
            ),
          })
          .click();
        await expectNoAxeViolations(page);
      });
    }
  }

  test("zero violations at 360 px, both themes, in every section", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "it");
      await add(page, "it", "pasta");
      await expectNoAxeViolations(page);
      await tab(page, "it", "cashflow");
      await page.locator('[data-table="flow"] summary').click();
      await expectNoAxeViolations(page);
      await tab(page, "it", "orders");
      await expectNoAxeViolations(page);
    }
  });
});

test.describe("layout and stability", () => {
  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll in any section, tables open`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, "it");
      const overflow = () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );

      await add(page, "it", "coffee");
      expect(await overflow()).toBeLessThanOrEqual(0);
      await tab(page, "it", "cashflow");
      for (const which of ["balance", "flow"]) {
        await page.locator(`[data-table="${which}"] summary`).click();
      }
      expect(await overflow()).toBeLessThanOrEqual(0);
      await tab(page, "it", "orders");
      expect(await overflow()).toBeLessThanOrEqual(0);
    });
  }

  test("the two charts sit side by side on a desktop and stack on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, "it");
    await tab(page, "it", "cashflow");
    const sideBySide = async () => {
      const [a, b] = await Promise.all([
        demo(page, "it").getByRole("img").nth(0).boundingBox(),
        demo(page, "it").getByRole("img").nth(1).boundingBox(),
      ]);
      return Math.abs((a?.y ?? 0) - (b?.y ?? 1000)) < 80;
    };

    expect(await sideBySide()).toBe(true);
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await sideBySide()).toBe(false);
  });

  test("CLS stays under 0.05 on load and through a sale and the dashboard", async ({
    page,
  }) => {
    await trackLayoutShift(page);
    await page.goto(`/it/work/${SLUG}`);
    await waitForHydration(page);
    await add(page, "it", "coffee");
    await pay(page, "it", "cash");
    await tab(page, "it", "cashflow");

    expect(await layoutShift(page)).toBeLessThan(0.05);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page is readable: the disclosure, the limits, the till's products and a notice that the controls need JavaScript", async ({
    page,
  }) => {
    const c = copy("it");
    await page.goto(`/it/work/${SLUG}`);

    await expect(page.getByText(c.disclosure)).toBeVisible();
    await expect(page.getByText(c.noscript)).toBeVisible();
    await expect(page.getByText(c.limits.local)).toBeVisible();
    await expect(page.locator("[data-product]")).toHaveCount(8);
    await expect(page.getByText(c.items.coffee).first()).toBeVisible();
    await expect(
      demo(page, "it").getByRole("link", { name: shellCopy("it").cta }),
    ).toHaveAttribute("href", "/it/contact?service=web-applications");
  });
});
