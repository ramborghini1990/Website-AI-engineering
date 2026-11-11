import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import { BusinessDemo } from "@/components/demos/business/business-demo";
import type { Locale } from "@/i18n/routing";
import {
  productIds,
  seedData,
  supplierIds,
} from "@/lib/demos/business/fixtures";
import { kpis } from "@/lib/demos/business/model";
import {
  createMemoryStore,
  type BusinessStore,
} from "@/lib/demos/business/storage";
import enMessages from "../../../../messages/en.json";
import itMessages from "../../../../messages/it.json";

const messages = { it: itMessages, en: enMessages } as const;
const copy = (locale: Locale = "it") => messages[locale].demos.business;

function renderDemo(locale: Locale = "it", store?: BusinessStore) {
  const backing = store ?? createMemoryStore();
  const view = render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ demos: messages[locale].demos }}
    >
      <BusinessDemo store={backing} />
    </NextIntlClientProvider>,
  );
  return { ...view, store: backing };
}

afterEach(cleanup);

/** The page's amount as the matcher sees it: jest-dom folds every kind of space (the no-break one too) into a plain one. */
const euro = (cents: number, locale: Locale = "it") =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" })
    .format(cents / 100)
    .replaceAll(/\s/g, " ");

/** Waits for the storage to be opened (the demo then saves what changes). */
const opened = (locale: Locale = "it") =>
  waitFor(() => {
    expect(screen.getByText(copy(locale).storage.saved)).toBeInTheDocument();
  });

const tab = (name: string) =>
  fireEvent.click(screen.getByRole("button", { name }));
const add = (
  locale: Locale,
  product: keyof typeof itMessages.demos.business.items,
) =>
  fireEvent.click(
    screen.getByRole("button", {
      name: copy(locale).pos.addLabel.replace(
        "{name}",
        copy(locale).items[product],
      ),
    }),
  );

describe("the till", () => {
  it("lists the products with their stock and shows an empty sale", () => {
    renderDemo();

    expect(document.querySelectorAll("[data-product]")).toHaveLength(8);
    expect(screen.getByText(copy().pos.cart.empty)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy().pos.pay.card }),
    ).toBeDisabled();
    expect(
      within(
        document.querySelector('[data-product="coffee"]') as HTMLElement,
      ).getByText(/12 in magazzino/),
    ).toBeInTheDocument();
  });

  it("a sale lowers the stock, empties the cart, is announced and is the newest sale in the list", async () => {
    renderDemo("en");
    await opened("en");

    add("en", "coffee");
    add("en", "coffee");
    add("en", "pasta");
    expect(document.querySelector("[data-cart-total]")).toHaveTextContent(
      euro(2 * 549 + 189, "en"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: copy("en").pos.pay.card }),
    );

    const id = `S-${String(seedData().sales.length + 1).padStart(4, "0")}`;
    expect(screen.getByRole("status")).toHaveTextContent(
      copy("en")
        .notice.sale.replace("{id}", id)
        .replace("{total}", euro(2 * 549 + 189, "en")),
    );
    expect(screen.getByText(copy("en").pos.cart.empty)).toBeInTheDocument();
    expect(
      within(
        document.querySelector('[data-product="coffee"]') as HTMLElement,
      ).getByText("10 in stock"),
    ).toBeInTheDocument();
    const first = document.querySelector("[data-recent-sales] tbody tr");
    expect(first).toHaveAttribute("data-sale", id);
  });

  it("refuses the unit that is not on the shelf: the notice says so and the sale keeps what is there (negative)", () => {
    renderDemo("en");

    for (let i = 0; i < 12; i += 1) add("en", "coffee");
    // the shelf is now empty of coffee: "Add" is disabled, and "one more" in the cart is refused
    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").pos.cart.more.replace(
          "{name}",
          copy("en").items.coffee,
        ),
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      copy("en").notice.limit.replace("{name}", copy("en").items.coffee),
    );
    expect(document.querySelector("[data-qty]")).toHaveTextContent("12");
    expect(
      screen.getByRole("button", {
        name: copy("en").pos.addLabel.replace(
          "{name}",
          copy("en").items.coffee,
        ),
      }),
    ).toBeDisabled();
  });

  it("one more, one less and remove work from the cart", () => {
    renderDemo("en");
    add("en", "oil");
    const name = copy("en").items.oil;

    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").pos.cart.more.replace("{name}", name),
      }),
    );
    expect(document.querySelector("[data-qty]")).toHaveTextContent("2");
    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").pos.cart.less.replace("{name}", name),
      }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").pos.cart.remove.replace("{name}", name),
      }),
    );
    expect(screen.getByText(copy("en").pos.cart.empty)).toBeInTheDocument();
  });

  it("has no text box, file input or editable region anywhere in the demo (negative)", async () => {
    const { container } = renderDemo();
    await opened();

    for (const name of [
      copy().tabs.cashflow,
      copy().tabs.orders,
      copy().tabs.pos,
    ]) {
      tab(name);
      expect(
        container.querySelectorAll(
          "input, textarea, select, [contenteditable]",
        ),
      ).toHaveLength(0);
    }
  });
});

describe("the cash-flow dashboard", () => {
  it("shows the key figures from the data, and a sale moves the balance", async () => {
    renderDemo("en");
    await opened("en");
    tab(copy("en").tabs.cashflow);
    const before = kpis(seedData()).balanceCents;

    expect(document.querySelector('[data-kpi="balance"]')).toHaveTextContent(
      euro(before, "en"),
    );
    tab(copy("en").tabs.pos);
    add("en", "oil");
    fireEvent.click(
      screen.getByRole("button", { name: copy("en").pos.pay.cash }),
    );
    tab(copy("en").tabs.cashflow);

    expect(document.querySelector('[data-kpi="balance"]')).toHaveTextContent(
      euro(before + 899, "en"),
    );
  });

  it("every chart is an image named by a title and a written description, and its figures are in a table (accessibility)", () => {
    renderDemo("en");
    tab(copy("en").tabs.cashflow);

    const charts = screen.getAllByRole("img");
    expect(
      charts.map((chart) => chart.querySelector("title")?.textContent),
    ).toEqual([copy("en").cash.balance.title, copy("en").cash.flow.title]);
    for (const chart of charts) {
      expect(chart.querySelector("desc")?.textContent.length).toBeGreaterThan(
        40,
      );
      // the image is named by its title and described by its description, by id
      const named = chart.getAttribute("aria-labelledby") ?? "";
      const described = chart.getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(named)?.tagName).toBe("title");
      expect(document.getElementById(described)?.tagName).toBe("desc");
    }
    const balance = document.querySelector('[data-table="balance"] table');
    const flow = document.querySelector('[data-table="flow"] table');
    expect(balance?.querySelectorAll("tbody tr")).toHaveLength(30);
    expect(flow?.querySelectorAll("tbody tr")).toHaveLength(8);
    expect(balance?.querySelector("caption")).toHaveTextContent(
      copy("en").cash.table.balanceCaption,
    );
    // the table has real headers, so a screen reader can read each cell with its column and row
    expect(flow?.querySelectorAll('th[scope="col"]')).toHaveLength(4);
    expect(flow?.querySelectorAll('tbody th[scope="row"]')).toHaveLength(8);
  });

  it("the bar chart is not told by colour alone: the legend names both series", () => {
    renderDemo("en");
    tab(copy("en").tabs.cashflow);

    const legend = screen.getByRole("list", {
      name: copy("en").cash.legend.label,
    });
    expect(legend).toHaveTextContent(copy("en").cash.legend.in);
    expect(legend).toHaveTextContent(copy("en").cash.legend.out);
  });
});

describe("purchase orders", () => {
  it("drafts a reorder for a supplier with low stock, sends it, receives it: the shelf, the open orders and the balance follow", async () => {
    renderDemo("en");
    await opened("en");
    tab(copy("en").tabs.orders);
    const supplier = copy("en").suppliers.verde;

    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").orders.reorder.createLabel.replace(
          "{supplier}",
          supplier,
        ),
      }),
    );
    const order = document.querySelector(
      '[data-order="PO-0005"]',
    ) as HTMLElement;
    expect(order).toHaveAttribute("data-status", "draft");
    expect(order).toHaveTextContent(`36 × ${copy("en").items.biscuits}`);
    expect(order).toHaveTextContent(`30 × ${copy("en").items.tea}`);
    // the new draft takes the verde products off the reorder list
    expect(
      screen.getByRole("button", {
        name: copy("en").orders.reorder.createLabel.replace(
          "{supplier}",
          supplier,
        ),
      }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").orders.list.sendLabel.replace("{id}", "PO-0005"),
      }),
    );
    expect(order).toHaveAttribute("data-status", "sent");
    fireEvent.click(
      screen.getByRole("button", {
        name: copy("en").orders.list.receiveLabel.replace("{id}", "PO-0005"),
      }),
    );

    expect(document.querySelector('[data-order="PO-0005"]')).toHaveAttribute(
      "data-status",
      "received",
    );
    expect(
      document.querySelector('[data-stock-row="tea"] [data-shelf]'),
    ).toHaveTextContent("38");
    expect(screen.getByRole("status")).toHaveTextContent(
      copy("en").notice.orderReceived.replace("{id}", "PO-0005"),
    );
  });

  it("a draft cannot be received before it is sent: there is no button for it (negative)", () => {
    renderDemo("en");
    tab(copy("en").tabs.orders);

    expect(
      screen.queryByRole("button", {
        name: copy("en").orders.list.receiveLabel.replace("{id}", "PO-0004"),
      }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: copy("en").orders.list.receiveLabel.replace("{id}", "PO-0001"),
      }),
    ).toBeNull();
  });
});

describe("what is kept in the browser", () => {
  it("saves a change to the store, and a new visit starts from it", async () => {
    const first = renderDemo("en");
    await opened("en");
    add("en", "tea");
    fireEvent.click(
      screen.getByRole("button", { name: copy("en").pos.pay.cash }),
    );
    await waitFor(async () => {
      const loaded = await first.store.load();
      expect(loaded.status === "ok" && loaded.data?.sales.length).toBe(
        seedData().sales.length + 1,
      );
    });
    first.unmount();

    renderDemo("en", first.store);

    await waitFor(() => {
      expect(document.querySelector('[data-product="tea"]')).toHaveTextContent(
        "7 in stock",
      );
    });
  });

  it("start over restores the sample data and erases what was saved", async () => {
    const view = renderDemo("en");
    await opened("en");
    add("en", "tea");
    fireEvent.click(
      screen.getByRole("button", { name: copy("en").pos.pay.cash }),
    );
    await waitFor(async () => {
      expect(await view.store.load()).not.toEqual({ status: "ok", data: null });
    });

    fireEvent.click(
      screen.getByRole("button", { name: messages.en.demos.shell.reset }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        copy("en").notice.reset,
      );
    });
    expect(document.querySelector('[data-product="tea"]')).toHaveTextContent(
      "8 in stock",
    );
    await waitFor(async () => {
      expect(await view.store.load()).toEqual({ status: "ok", data: null });
    });
  });

  it("with the storage refused the demo still works and says the changes last only until the page closes", async () => {
    const refused: BusinessStore = {
      load: () => Promise.resolve({ status: "unavailable" }),
      save: () => Promise.resolve(false),
      clear: () => Promise.resolve(false),
    };
    renderDemo("en", refused);

    await waitFor(() => {
      expect(
        screen.getByText(copy("en").storage.unavailable),
      ).toBeInTheDocument();
    });
    add("en", "soap");
    fireEvent.click(
      screen.getByRole("button", { name: copy("en").pos.pay.cash }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/S-\d{4}/);
  });

  it("a stored value that is not a valid save is ignored: the sample data shows (negative)", async () => {
    renderDemo(
      "en",
      createMemoryStore({ version: 1, stock: { tea: -5 }, admin: true }),
    );

    await opened("en");
    expect(document.querySelector('[data-product="tea"]')).toHaveTextContent(
      "8 in stock",
    );
  });
});

describe("both languages", () => {
  it("every product and supplier has a name in both, and both files have the same keys", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix];

    for (const locale of ["it", "en"] as const) {
      for (const id of productIds) {
        expect(copy(locale).items[id], `${locale}/${id}`).toBeTruthy();
      }
      for (const id of supplierIds) {
        expect(copy(locale).suppliers[id], `${locale}/${id}`).toBeTruthy();
      }
    }
    expect(keys(copy("it")).sort()).toEqual(keys(copy("en")).sort());
  });

  it("the Italian page renders in Italian numbers", () => {
    renderDemo("it");
    tab(copy("it").tabs.cashflow);

    expect(document.querySelector('[data-kpi="balance"]')).toHaveTextContent(
      euro(kpis(seedData()).balanceCents, "it"),
    );
  });
});
