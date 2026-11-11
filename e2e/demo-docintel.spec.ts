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
import { isDemoEvent } from "./support/analytics";

/**
 * The document intelligence demo (P3.3) on the PRODUCTION build with the CSP
 * enforced: a simulation on bundled sample documents, so the tests prove what
 * that promises: nothing can be uploaded or typed, it works with no network,
 * the fields match the fixtures, every answer cites the right page and section,
 * a doubtful value stays flagged until a person checks it, and the page is
 * accessible and responsive. The extraction rules are unit-tested per document
 * and language; here they are checked as the visitor sees them.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LOCALES = ["it", "en"] as const;
const messages = { it, en } as const;
const SLUG = "document-intelligence-demo";

type Locale = (typeof LOCALES)[number];
type DocId = "invoice" | "contract" | "ddt";

const demoCopy = (locale: Locale) => messages[locale].demos.docIntel;
const shellCopy = (locale: Locale) => messages[locale].demos.shell;

async function open(page: Page, locale: Locale) {
  await page.goto(`/${locale}/work/${SLUG}`);
  await waitForHydration(page);
  await settleAnimations(page);
}

const demo = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: shellCopy(locale).title });
const picker = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).picker.title });
const viewer = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).viewer.title });
const fields = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).fields.title });
const qa = (page: Page, locale: Locale) =>
  page.getByRole("region", { name: demoCopy(locale).qa.title });
const status = (page: Page, locale: Locale) =>
  demo(page, locale).getByRole("status");
const field = (page: Page, locale: Locale, id: string) =>
  fields(page, locale).locator(`[data-field="${id}"]`);
const readButton = (page: Page, locale: Locale) =>
  page.getByRole("button", { name: demoCopy(locale).controls.read });
const docName = (locale: Locale, id: DocId) => demoCopy(locale).docs[id].name;
const choose = (page: Page, locale: Locale, id: DocId) =>
  picker(page, locale)
    .getByRole("button", {
      name: new RegExp(`^${escape(docName(locale, id))}`),
    })
    .click();
const ask = (page: Page, locale: Locale, text: string) =>
  qa(page, locale).getByRole("button", { name: text }).click();

function escape(text: string) {
  return text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

async function read(page: Page, locale: Locale) {
  await readButton(page, locale).click();
  await expect(status(page, locale)).toContainText(
    demoCopy(locale).controls.done.split("{")[0] ?? "",
    { timeout: 15_000 },
  );
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("the page", () => {
  for (const locale of LOCALES) {
    const c = demoCopy(locale);

    test(`/${locale}: the page has its h1, a Simulation badge, the disclosure, the limits and the three sample documents`, async ({
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
      for (const key of ["upload", "synthetic", "rules", "review"] as const) {
        await expect(limits).toContainText(c.limits[key]);
      }
      await expect(picker(page, locale).getByRole("button")).toHaveCount(3);
      await expect(viewer(page, locale)).toContainText("FT-2026/0142");
    });

    test(`/${locale}: the disclosure, the limits and the first document are in the HTML, in that order`, async ({
      request,
    }) => {
      const html = await (await request.get(`/${locale}/work/${SLUG}`)).text();

      const disclosureAt = html.indexOf(c.disclosure.slice(0, 40));
      const limitsAt = html.indexOf(c.limits.upload.slice(0, 30));
      const documentAt = html.indexOf("FT-2026/0142");
      expect(disclosureAt).toBeGreaterThan(-1);
      expect(limitsAt).toBeGreaterThan(disclosureAt);
      expect(documentAt).toBeGreaterThan(limitsAt);
    });
  }
});

test.describe("no uploads, no free text (reduced motion: instant)", () => {
  test.use({ reducedMotion: "reduce" });

  test("there is no file input, text box or drop zone anywhere on the page, before or after reading (negative)", async ({
    page,
  }) => {
    await open(page, "it");
    const surface = async () => ({
      files: await page.locator("input[type='file']").count(),
      // Scoped to the demo: the site header has its own controls.
      texts: await demo(page, "it")
        .locator(
          "textarea, input:not([type='checkbox']), [contenteditable='true']",
        )
        .count(),
      textboxes: await demo(page, "it").getByRole("textbox").count(),
    });

    expect(await surface()).toEqual({ files: 0, texts: 0, textboxes: 0 });
    await read(page, "it");
    await ask(page, "it", demoCopy("it").docs.invoice.questions.vat.q);
    expect(await surface()).toEqual({ files: 0, texts: 0, textboxes: 0 });
  });

  test("dropping a file on the page changes nothing and sends nothing (negative)", async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? "http://localhost:3100").origin;
    const sent: string[] = [];
    await open(page, "it");
    await page.waitForLoadState("networkidle");
    page.on("request", (request) => {
      if (isDemoEvent(request, origin)) return; // the cookieless funnel event (P3.5), checked in demo-analytics.spec.ts
      if (request.method() !== "GET") sent.push(request.url());
      if (new URL(request.url()).origin !== origin) sent.push(request.url());
    });

    await page.evaluate(() => {
      const data = new DataTransfer();
      data.items.add(new File(["secret"], "private.pdf"));
      for (const type of ["dragenter", "dragover", "drop"]) {
        document
          .querySelector("main")
          ?.dispatchEvent(
            new DragEvent(type, { dataTransfer: data, bubbles: true }),
          );
      }
    });

    expect(sent).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`/it/work/${SLUG}$`));
    await expect(viewer(page, "it")).toContainText("FT-2026/0142");
    expect(await page.getByText("private.pdf").count()).toBe(0);
  });
});

test.describe("reading the documents (reduced motion: instant)", () => {
  test.use({ reducedMotion: "reduce" });

  test("before the reading every field is listed as not read yet and the questions are locked (negative)", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");

    await expect(fields(page, "it").locator("[data-field]")).toHaveCount(12);
    await expect(fields(page, "it").getByText(c.fields.pending)).toHaveCount(
      12,
    );
    await expect(qa(page, "it").getByText(c.qa.locked)).toBeVisible();
    for (const button of await qa(page, "it").getByRole("button").all()) {
      await expect(button).toBeDisabled();
    }
    await expect(page.locator("main mark")).toHaveCount(0);
  });

  test("the invoice gives the fields the page promises, normalised, with the words they came from underlined", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");

    await expect(status(page, "it")).toHaveText(
      c.controls.done
        .replace("{total}", "12")
        .replace("{ok}", "11")
        .replace("{review}", "1"),
    );
    await expect(field(page, "it", "invoiceNo")).toContainText("FT-2026/0142");
    await expect(field(page, "it", "issueDate")).toContainText("14 marzo 2026");
    await expect(field(page, "it", "net")).toContainText(/1\.?000,00/);
    await expect(field(page, "it", "vat")).toContainText(/220,00/);
    await expect(field(page, "it", "total")).toContainText(/1\.?220,00/);
    await expect(field(page, "it", "vatRate")).toContainText("22%");
    await expect(page.locator("main mark")).toHaveCount(12);
    await expect(viewer(page, "it").locator("mark").first()).toHaveCSS(
      "text-decoration-line",
      "underline",
    );
    await expect(page.locator("[data-sum-check='ok']")).toContainText(
      c.fields.sumOk,
    );
  });

  test("the English page writes the same values in English notation", async ({
    page,
  }) => {
    await open(page, "en");
    await read(page, "en");

    await expect(field(page, "en", "total")).toContainText("€1,220.00");
    await expect(field(page, "en", "dueDate")).toContainText("April 13, 2026");
    await expect(field(page, "en", "paymentDays")).toContainText("30 days");
  });

  test("each document reads to its own fixtures, and the doubtful value of each is flagged", async ({
    page,
  }) => {
    const flagged: Record<DocId, string> = {
      invoice: "po",
      contract: "monthlyFee",
      ddt: "grossWeight",
    };
    const counts: Record<DocId, number> = { invoice: 12, contract: 9, ddt: 10 };
    await open(page, "it");

    for (const id of ["invoice", "contract", "ddt"] as const) {
      await choose(page, "it", id);
      await expect(fields(page, "it").locator("[data-field]")).toHaveCount(
        counts[id],
      );
      await read(page, "it");
      await expect(
        fields(page, "it").locator("[data-status='review']"),
      ).toHaveCount(1);
      await expect(field(page, "it", flagged[id])).toHaveAttribute(
        "data-status",
        "review",
      );
      await expect(page.locator("main mark")).toHaveCount(counts[id]);
    }
    await expect(field(page, "it", "grossWeight")).toContainText(
      "148 chilogrammi",
    );
    await expect(field(page, "it", "packages")).toContainText("3");
  });

  test("a value that needs checking stays flagged until the person marks it; only that field offers a checkbox", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");
    const box = fields(page, "it").getByRole("checkbox");

    await expect(box).toHaveCount(1);
    await expect(field(page, "it", "po")).toContainText(
      c.fields.reason.ambiguous,
    );
    await expect(field(page, "it", "po")).toContainText(c.fields.status.review);
    await box.check();

    await expect(field(page, "it", "po")).toContainText(c.fields.checked);
    await expect(demo(page, "it").getByLabel(c.summary.title)).toContainText(
      `${c.summary.checked}1`,
    );
    await box.uncheck();
    await expect(field(page, "it", "po")).toContainText(c.fields.status.review);
  });

  test("switching document in the middle of a read abandons it, and start over empties everything", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");
    await choose(page, "it", "contract");
    await expect(
      fields(page, "it").locator("[data-status='pending']"),
    ).toHaveCount(9);

    await page.getByRole("button", { name: shellCopy("it").reset }).click();

    await expect(
      picker(page, "it").locator("[aria-current='true']"),
    ).toContainText(docName("it", "invoice"));
    await expect(
      fields(page, "it").locator("[data-status='pending']"),
    ).toHaveCount(12);
    await expect(qa(page, "it").getByText(c.qa.locked)).toBeVisible();
  });
});

test.describe("questions with citations (reduced motion: instant)", () => {
  test.use({ reducedMotion: "reduce" });

  test("an answer cites the exact sentence, page and section, and focus moves to it", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");

    await ask(page, "it", c.docs.invoice.questions.amountDue.q);

    const answer = qa(page, "it").locator("[data-answer]");
    await expect(answer).toBeFocused();
    await expect(answer).toContainText(/1\.?220,00/);
    await expect(answer).toContainText("13 aprile 2026");
    const citations = answer.locator("[data-citation]");
    await expect(citations).toHaveCount(2);
    await expect(citations.nth(0)).toContainText("Scadenza: 13/04/2026");
    await expect(citations.nth(0)).toContainText(
      c.qa.source
        .replace("{page}", "1")
        .replace("{section}", c.docs.invoice.sections.header.heading),
    );
    await expect(citations.nth(1)).toContainText(
      "Totale da pagare: € 1.220,00",
    );
    await expect(citations.nth(1)).toContainText(
      c.qa.source
        .replace("{page}", "2")
        .replace("{section}", c.docs.invoice.sections.totals.heading),
    );
  });

  test("following a citation outlines that very section in the document, labelled, and says where", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");
    await ask(page, "it", c.docs.invoice.questions.amountDue.q);

    await page.locator("[data-citation='totals']").getByRole("button").click();

    const cited = viewer(page, "it").locator("[data-cited]");
    await expect(cited).toHaveCount(1);
    await expect(cited).toHaveAttribute("data-section", "totals");
    await expect(cited).toContainText(c.viewer.cited);
    await expect(cited).toContainText("Totale da pagare: € 1.220,00");
    await expect(status(page, "it")).toHaveText(
      c.controls.showing
        .replace("{page}", "2")
        .replace("{section}", c.docs.invoice.sections.totals.heading),
    );
  });

  test("a field's source button points at the section the value was read from", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");
    await choose(page, "it", "contract");
    await read(page, "it");

    await field(page, "it", "noticeDays").getByRole("button").click();

    await expect(viewer(page, "it").locator("[data-cited]")).toHaveAttribute(
      "data-section",
      "renewal",
    );
    await expect(viewer(page, "it").locator("[data-cited]")).toContainText(
      c.docs.contract.sections.renewal.heading,
    );
  });

  test("the contract's renewal answer cites the term and the renewal articles, on pages 1 and 2", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await choose(page, "it", "contract");
    await read(page, "it");

    await ask(page, "it", c.docs.contract.questions.renewal.q);

    const citations = qa(page, "it").locator("[data-citation]");
    await expect(citations).toHaveCount(2);
    await expect(citations.nth(0)).toHaveAttribute("data-citation", "term");
    await expect(citations.nth(1)).toHaveAttribute("data-citation", "renewal");
    await expect(citations.nth(1)).toContainText("almeno 60 giorni prima");
    await expect(qa(page, "it").locator("[data-answer]")).toContainText(
      "1 aprile 2026",
    );
  });

  test("a question the document cannot answer says so and cites nothing (negative)", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await read(page, "it");

    await ask(page, "it", c.docs.invoice.questions.discount.q);

    const answer = qa(page, "it").locator("[data-answer]");
    await expect(answer).toHaveAttribute("data-answer", "notFound");
    await expect(answer).toContainText(c.qa.notFound);
    await expect(answer).toContainText(c.qa.noSource);
    await expect(answer.locator("[data-citation]")).toHaveCount(0);
  });

  test("an answer that rests on a doubtful value says so until the person has checked it", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await choose(page, "it", "contract");
    await read(page, "it");

    await ask(page, "it", c.docs.contract.questions.fee.q);
    await expect(qa(page, "it").getByText(c.qa.unchecked)).toBeVisible();
    await field(page, "it", "monthlyFee").getByRole("checkbox").check();

    await expect(qa(page, "it").getByText(c.qa.unchecked)).toHaveCount(0);
  });

  test("an answer on clean values carries no warning", async ({ page }) => {
    const c = demoCopy("it");
    await open(page, "it");
    await choose(page, "it", "ddt");
    await read(page, "it");

    await ask(page, "it", c.docs.ddt.questions.who.q);

    await expect(qa(page, "it").locator("[data-answer]")).toContainText(
      "Tessitura Valle S.r.l. spedisce a Orso Allestimenti S.r.l.",
    );
    await expect(qa(page, "it").getByText(c.qa.unchecked)).toHaveCount(0);
  });
});

test.describe("pacing (motion allowed)", () => {
  test("the document is read one field at a time, with progress announced and the button busy", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");

    await readButton(page, "it").click();

    await expect(
      page.getByRole("button", { name: c.controls.reading }),
    ).toBeDisabled();
    await expect(status(page, "it")).toContainText(/Letti \d+ campi su 12/);
    await expect(status(page, "it")).toContainText(
      c.controls.done.split("{")[0] ?? "",
      { timeout: 15_000 },
    );
  });
});

test.describe("zero network, zero storage, strict CSP", () => {
  test.use({ reducedMotion: "reduce" });

  test("a whole session over the three documents makes no request to anywhere else, sends nothing, stores nothing, and the CSP is never violated", async ({
    page,
    baseURL,
  }) => {
    const c = demoCopy("it");
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
      if (isDemoEvent(request, origin)) return; // the cookieless funnel event (P3.5), checked in demo-analytics.spec.ts
      const url = new URL(request.url());
      if (url.origin !== origin) offenders.push(`foreign ${request.url()}`);
      if (request.method() !== "GET")
        offenders.push(`${request.method()} ${request.url()}`);
      if (url.pathname.startsWith("/api"))
        offenders.push(`api ${request.url()}`);
    });

    await read(page, "it");
    await ask(page, "it", c.docs.invoice.questions.amountDue.q);
    await page.locator("[data-citation='totals']").getByRole("button").click();
    await fields(page, "it").getByRole("checkbox").check();
    await choose(page, "it", "contract");
    await read(page, "it");
    await ask(page, "it", c.docs.contract.questions.fee.q);
    await choose(page, "it", "ddt");
    await read(page, "it");
    await ask(page, "it", c.docs.ddt.questions.insured.q);
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
    await read(page, "en");
    await page.waitForLoadState("networkidle");

    expect(foreign).toEqual([]);
  });
});

test.describe("the call to action into the funnel", () => {
  for (const locale of LOCALES) {
    test(`${locale}: it goes to the contact page with the service pre-selected, and the form shows the need chosen`, async ({
      page,
    }) => {
      await open(page, locale);

      const link = demo(page, locale).getByRole("link", {
        name: shellCopy(locale).cta,
      });
      await expect(link).toHaveAttribute(
        "href",
        `/${locale}/contact?service=document-intelligence`,
      );
      await link.click();

      await expect(page).toHaveURL(
        new RegExp(`/${locale}/contact\\?service=document-intelligence$`),
      );
      await waitForHydration(page);
      const f = messages[locale].contact.form;
      await expect(
        page.getByRole("radio", {
          name: f.need.options["document-intelligence"],
        }),
      ).toBeChecked();
      await expect(page.getByLabel(f.need.descriptionLabel)).toHaveValue("");
    });
  }

  test("the demo's own call to action says what this demo is for", async ({
    page,
  }) => {
    await open(page, "it");

    await expect(
      demo(page, "it").getByRole("heading", { name: demoCopy("it").ctaTitle }),
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
    ).toHaveAttribute("href", "/it/contact?service=document-intelligence");
  });

  test("the document intelligence service page now links to this demo", async ({
    page,
  }) => {
    await page.goto("/it/services/document-intelligence");

    await expect(page.locator(`a[href='/it/work/${SLUG}']`)).toHaveCount(1);
  });
});

test.describe("keyboard", () => {
  test.use({ reducedMotion: "reduce" });

  test("the whole flow works with the keyboard: pick a document, read it, ask, follow a citation, check a value", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await open(page, "it");

    await picker(page, "it")
      .getByRole("button", {
        name: new RegExp(`^${escape(docName("it", "contract"))}`),
      })
      .focus();
    await page.keyboard.press("Enter");
    await readButton(page, "it").focus();
    await page.keyboard.press("Enter");
    await expect(status(page, "it")).toContainText(
      c.controls.done.split("{")[0] ?? "",
      { timeout: 15_000 },
    );
    await qa(page, "it")
      .getByRole("button", { name: c.docs.contract.questions.fee.q })
      .focus();
    await page.keyboard.press("Enter");
    await expect(qa(page, "it").locator("[data-answer]")).toBeFocused();
    await qa(page, "it")
      .locator("[data-citation]")
      .first()
      .getByRole("button")
      .focus();
    await page.keyboard.press("Enter");
    await expect(viewer(page, "it").locator("[data-cited]")).toHaveCount(1);
    await field(page, "it", "monthlyFee").getByRole("checkbox").focus();
    await page.keyboard.press("Space");

    await expect(field(page, "it", "monthlyFee")).toContainText(
      c.fields.checked,
    );
  });
});

test.describe("accessibility (axe, WCAG 2.0-2.2 A/AA)", () => {
  test.use({ reducedMotion: "reduce" });

  for (const scheme of ["dark", "light"] as const) {
    for (const locale of LOCALES) {
      test(`${locale} (${scheme}): initial, read, answered, cited and checked: zero violations`, async ({
        page,
      }) => {
        const c = demoCopy(locale);
        await page.emulateMedia({ colorScheme: scheme });
        await open(page, locale);
        await expectNoAxeViolations(page);

        await read(page, locale);
        await expectNoAxeViolations(page);

        await ask(page, locale, c.docs.invoice.questions.amountDue.q);
        await expectNoAxeViolations(page);

        await page
          .locator("[data-citation='totals']")
          .getByRole("button")
          .click();
        await expectNoAxeViolations(page);

        await fields(page, locale).getByRole("checkbox").check();
        await expectNoAxeViolations(page);
      });
    }
  }

  test("every document and every kind of answer is accessible (answered with a warning, not found)", async ({
    page,
  }) => {
    const c = demoCopy("en");
    await open(page, "en");

    for (const id of ["contract", "ddt"] as const) {
      await choose(page, "en", id);
      await read(page, "en");
      await expectNoAxeViolations(page);
    }
    await ask(page, "en", c.docs.ddt.questions.weight.q);
    await expectNoAxeViolations(page);
    await ask(page, "en", c.docs.ddt.questions.insured.q);
    await expectNoAxeViolations(page);
  });

  test("zero violations at 360 px, both themes, read and answered", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, "it");
      await choose(page, "it", "contract");
      await read(page, "it");
      await ask(page, "it", demoCopy("it").docs.contract.questions.fee.q);
      await expectNoAxeViolations(page);
    }
  });
});

test.describe("layout and stability", () => {
  test.use({ reducedMotion: "reduce" });

  for (const width of [360, 768, 1280, 1920]) {
    test(`${String(width)} px: no horizontal scroll, before the reading and after an answer`, async ({
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

      expect(await overflow()).toBeLessThanOrEqual(0);
      await choose(page, "it", "contract");
      await read(page, "it");
      await ask(page, "it", demoCopy("it").docs.contract.questions.renewal.q);
      expect(await overflow()).toBeLessThanOrEqual(0);
    });
  }

  test("the document and the extracted fields sit side by side on a desktop and stack on a phone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await open(page, "it");
    const sideBySide = async () => {
      const a = await viewer(page, "it").boundingBox();
      const b = await fields(page, "it").boundingBox();
      return Math.abs((a?.y ?? 0) - (b?.y ?? 1000)) < 40;
    };

    expect(await sideBySide()).toBe(true);
    await page.setViewportSize({ width: 360, height: 900 });
    expect(await sideBySide()).toBe(false);
  });

  test("CLS stays under 0.05 on load and through a read and an answer", async ({
    page,
  }) => {
    await trackLayoutShift(page);
    await page.goto(`/it/work/${SLUG}`);
    await waitForHydration(page);
    await read(page, "it");
    await ask(page, "it", demoCopy("it").docs.invoice.questions.vat.q);

    expect(await layoutShift(page)).toBeLessThan(0.05);
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page is readable: the disclosure, the limits, the first document, its field list and a notice that the controls need JavaScript", async ({
    page,
  }) => {
    const c = demoCopy("it");
    await page.goto(`/it/work/${SLUG}`);

    await expect(page.getByText(c.disclosure)).toBeVisible();
    await expect(page.getByText(c.noscript)).toBeVisible();
    await expect(page.getByText(c.limits.upload)).toBeVisible();
    await expect(page.getByText("FT-2026/0142").first()).toBeVisible();
    await expect(
      fields(page, "it").getByText(c.docs.invoice.fields.total),
    ).toBeVisible();
    await expect(
      demo(page, "it").getByRole("link", { name: shellCopy("it").cta }),
    ).toHaveAttribute("href", "/it/contact?service=document-intelligence");
  });
});
