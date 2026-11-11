import { describe, expect, it } from "vitest";

import { businessEngine } from "@/lib/demos/business/engine";
import {
  addDays,
  assembleSeed,
  dayOfWeek,
  DEMO_TODAY,
  productIds,
  products,
  seedData,
  WINDOW_DAYS,
  type BusinessData,
} from "@/lib/demos/business/fixtures";
import {
  balanceSeries,
  cartTotal,
  kpis,
  orderTotal,
  stockRows,
  suggestedLines,
  vatIncluded,
  weeklyFlows,
} from "@/lib/demos/business/model";
import {
  initialState,
  reducer,
  type DemoAction,
  type State,
} from "@/lib/demos/business/state";
import {
  createIndexedDbStore,
  createMemoryStore,
  parseBusinessData,
} from "@/lib/demos/business/storage";

const run = (actions: DemoAction[], from: State = initialState()): State =>
  actions.reduce(reducer, from);

describe("the sample business", () => {
  it("is the same every time (seeded, no clock, no randomness)", () => {
    expect(seedData()).toEqual(seedData());
    expect(seedData().sales.length).toBeGreaterThan(200);
  });

  it("covers exactly the window, ends on the demo day, and is closed on Sundays", () => {
    const data = seedData();
    const dates = data.sales.map((s) => s.date);

    expect(data.today).toBe(DEMO_TODAY);
    expect(data.startDate).toBe(addDays(DEMO_TODAY, -(WINDOW_DAYS - 1)));
    expect(Math.min(...dates.map((d) => Date.parse(d)))).toBeGreaterThanOrEqual(
      Date.parse(data.startDate),
    );
    expect(dates.every((d) => d <= DEMO_TODAY)).toBe(true);
    expect(dates.some((d) => dayOfWeek(d) === 0)).toBe(false);
  });

  it("has unique ids, totals that match their lines, and no negative stock", () => {
    const data = seedData();

    expect(new Set(data.sales.map((s) => s.id)).size).toBe(data.sales.length);
    for (const sale of data.sales) {
      const expected = sale.lines.reduce(
        (sum, l) =>
          sum +
          (products.find((p) => p.id === l.product)?.priceCents ?? 0) * l.qty,
        0,
      );
      expect(sale.totalCents, sale.id).toBe(expected);
    }
    for (const id of productIds) {
      expect(data.stock[id]).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps the cash balance positive through the whole window", () => {
    const series = balanceSeries(seedData(), WINDOW_DAYS);

    expect(series).toHaveLength(WINDOW_DAYS);
    expect(Math.min(...series.map((p) => p.balanceCents))).toBeGreaterThan(0);
  });

  it("has products below their reorder level, so the purchasing screen has something to do", () => {
    const low = stockRows(seedData()).filter((r) => r.low && !r.onOrder);

    expect(low.map((r) => r.product).sort()).toEqual([
      "biscuits",
      "coffee",
      "tea",
    ]);
  });

  it("streams through the demo engine to the very same data", async () => {
    const parts = [];
    for await (const part of businessEngine.run(
      {},
      { sessionId: "t", locale: "it" },
    )) {
      parts.push(part);
    }

    expect(businessEngine.mode).toBe("simulation");
    expect(parts.map((p) => p.part)).toEqual([
      "stock",
      "sales",
      "expenses",
      "orders",
    ]);
    expect(assembleSeed(parts)).toEqual(seedData());
  });
});

describe("money rules", () => {
  it("splits the VAT out of a VAT-inclusive total (22%)", () => {
    expect(vatIncluded(12_200)).toBe(2200);
    expect(vatIncluded(549)).toBe(99);
    expect(vatIncluded(0)).toBe(0);
  });

  it("totals a cart and an order in integer cents", () => {
    expect(
      cartTotal([
        { product: "coffee", qty: 2 },
        { product: "pasta", qty: 3 },
      ]),
    ).toBe(2 * 549 + 3 * 189);
    expect(
      orderTotal({ lines: [{ product: "rice", qty: 48, unitCostCents: 130 }] }),
    ).toBe(6240);
  });

  it("the balance on the last day is the opening balance plus everything in minus everything out", () => {
    const data = seedData();
    const received = data.orders
      .filter((o) => o.status === "received")
      .reduce((sum, o) => sum + orderTotal(o), 0);
    const expected =
      data.openingBalanceCents +
      data.sales.reduce((sum, s) => sum + s.totalCents, 0) -
      data.expenses.reduce((sum, e) => sum + e.amountCents, 0) -
      received;

    expect(balanceSeries(data).at(-1)?.balanceCents).toBe(expected);
    expect(kpis(data).balanceCents).toBe(expected);
  });

  it("weekly buckets add up to the same money as the daily flows they cover", () => {
    const data = seedData();
    const weeks = weeklyFlows(data, 8);

    expect(weeks).toHaveLength(8);
    expect(weeks.at(-1)?.end).toBe(DEMO_TODAY);
    const inTotal = weeks.reduce((sum, w) => sum + w.inCents, 0);
    const cutoff = addDays(DEMO_TODAY, -55);
    const sales = data.sales
      .filter((s) => s.date >= cutoff)
      .reduce((sum, s) => sum + s.totalCents, 0);
    expect(inTotal).toBe(sales);
  });

  it("an order that is not received yet costs nothing", () => {
    const before = seedData();
    const withoutOpen: BusinessData = {
      ...before,
      orders: before.orders.filter((o) => o.status === "received"),
    };

    expect(kpis(before).balanceCents).toBe(kpis(withoutOpen).balanceCents);
    expect(kpis(before).openOrdersCents).toBeGreaterThan(0);
    expect(kpis(withoutOpen).openOrdersCents).toBe(0);
  });
});

describe("the till (point of sale)", () => {
  it("ringing up a cart lowers the stock, adds one sale dated today and empties the cart", () => {
    const state = run([
      { type: "add", product: "coffee" },
      { type: "add", product: "coffee" },
      { type: "add", product: "pasta" },
      { type: "checkout", method: "card" },
    ]);
    const sale = state.data.sales.at(-1);

    expect(state.cart).toEqual([]);
    expect(state.data.stock.coffee).toBe(12 - 2);
    expect(state.data.stock.pasta).toBe(64 - 1);
    expect(sale).toMatchObject({
      date: DEMO_TODAY,
      method: "card",
      totalCents: 2 * 549 + 189,
    });
    expect(state.notice).toEqual({
      kind: "sale",
      id: sale?.id,
      totalCents: 2 * 549 + 189,
    });
    expect(sale?.id).toBe(
      `S-${String(seedData().sales.length + 1).padStart(4, "0")}`,
    );
  });

  it("adds money in on the demo day", () => {
    const before = kpis(initialState().data).balanceCents;
    const state = run([
      { type: "add", product: "oil" },
      { type: "checkout", method: "cash" },
    ]);

    expect(kpis(state.data).balanceCents).toBe(before + 899);
  });

  it("never sells more than the shelf holds: the extra unit is refused with a notice (negative)", () => {
    let state = initialState();
    for (let i = 0; i < 12; i += 1) {
      state = reducer(state, { type: "add", product: "coffee" });
    }
    expect(state.cart).toEqual([{ product: "coffee", qty: 12 }]);

    state = reducer(state, { type: "add", product: "coffee" });
    expect(state.cart).toEqual([{ product: "coffee", qty: 12 }]);
    expect(state.notice).toEqual({ kind: "limit", product: "coffee" });
    state = reducer(state, { type: "step", product: "coffee", by: 1 });
    expect(state.cart).toEqual([{ product: "coffee", qty: 12 }]);
  });

  it("an empty cart cannot be paid, and an unknown payment method is ignored (negative)", () => {
    const state = initialState();

    expect(reducer(state, { type: "checkout", method: "cash" })).toBe(state);
    const filled = run([{ type: "add", product: "tea" }]);
    expect(
      reducer(filled, { type: "checkout", method: "crypto" as never }),
    ).toBe(filled);
  });

  it("an unknown product is ignored (negative)", () => {
    const state = initialState();

    expect(reducer(state, { type: "add", product: "gold" as never })).toBe(
      state,
    );
  });

  it("steps a quantity down to zero removes the line; remove drops it at once", () => {
    let state = run([
      { type: "add", product: "tea" },
      { type: "add", product: "tea" },
      { type: "add", product: "soap" },
    ]);
    state = reducer(state, { type: "step", product: "tea", by: -1 });
    expect(state.cart.find((l) => l.product === "tea")?.qty).toBe(1);
    state = reducer(state, { type: "step", product: "tea", by: -1 });
    expect(state.cart.map((l) => l.product)).toEqual(["soap"]);
    state = reducer(state, { type: "remove", product: "soap" });
    expect(state.cart).toEqual([]);
  });

  it("a cart is not part of the saved data and does not survive a reload of the data", () => {
    const state = run([{ type: "add", product: "tea" }]);

    expect(reducer(state, { type: "hydrate", data: seedData() }).cart).toEqual(
      [],
    );
  });
});

describe("purchase orders", () => {
  it("suggests only low products of that supplier that are not already on an open order", () => {
    const data = seedData();

    expect(suggestedLines(data, "rossi").map((l) => l.product)).toEqual([
      "coffee",
    ]);
    expect(suggestedLines(data, "verde").map((l) => l.product)).toEqual([
      "biscuits",
      "tea",
    ]);
    expect(suggestedLines(data, "alpina")).toEqual([]);
  });

  it("creates a draft with the suggested quantities, dated today, and moves it forward only", () => {
    let state = reducer(initialState(), {
      type: "order-create",
      supplier: "verde",
    });
    const order = state.data.orders.at(-1);

    expect(order).toMatchObject({
      id: "PO-0005",
      supplier: "verde",
      status: "draft",
      date: DEMO_TODAY,
      receivedDate: null,
    });
    expect(order?.lines.map((l) => [l.product, l.qty])).toEqual([
      ["biscuits", 36],
      ["tea", 30],
    ]);
    // a second order to the same supplier would only repeat the first
    const again = reducer(state, { type: "order-create", supplier: "verde" });
    expect(again.data.orders).toHaveLength(state.data.orders.length);

    state = reducer(state, { type: "order-send", id: "PO-0005" });
    expect(state.data.orders.at(-1)?.status).toBe("sent");
  });

  it("receiving a sent order raises the stock and books the money out that day", () => {
    const before = initialState();
    const state = reducer(before, { type: "order-receive", id: "PO-0003" });

    expect(state.data.stock.detergent).toBe(before.data.stock.detergent + 24);
    expect(state.data.stock.soap).toBe(before.data.stock.soap + 36);
    expect(state.data.orders.find((o) => o.id === "PO-0003")).toMatchObject({
      status: "received",
      receivedDate: DEMO_TODAY,
    });
    const paid = orderTotal(before.data.orders[2] ?? { lines: [] });
    expect(kpis(state.data).balanceCents).toBe(
      kpis(before.data).balanceCents - paid,
    );
    expect(kpis(state.data).openOrdersCents).toBe(
      kpis(before.data).openOrdersCents - paid,
    );
  });

  it("an order cannot skip a step, go back or arrive twice (negative)", () => {
    const state = initialState();

    // PO-0004 is a draft: it cannot be received before it is sent
    expect(reducer(state, { type: "order-receive", id: "PO-0004" })).toBe(
      state,
    );
    // PO-0001 is already received: it can be neither sent nor received again
    expect(reducer(state, { type: "order-send", id: "PO-0001" })).toBe(state);
    expect(reducer(state, { type: "order-receive", id: "PO-0001" })).toBe(
      state,
    );
    // a sent order cannot be sent again
    expect(reducer(state, { type: "order-send", id: "PO-0003" })).toBe(state);
    expect(reducer(state, { type: "order-receive", id: "PO-9999" })).toBe(
      state,
    );
  });

  it("an unknown supplier makes no order (negative)", () => {
    const state = initialState();

    expect(
      reducer(state, { type: "order-create", supplier: "x" as never }),
    ).toBe(state);
  });

  it("a received order takes the product off the reorder list", () => {
    const state = run([
      { type: "order-create", supplier: "rossi" },
      { type: "order-send", id: "PO-0005" },
    ]);
    const row = stockRows(state.data).find((r) => r.product === "coffee");

    expect(row).toMatchObject({ low: true, onOrder: true });
    const received = reducer(state, { type: "order-receive", id: "PO-0005" });
    expect(
      stockRows(received.data).find((r) => r.product === "coffee"),
    ).toMatchObject({
      low: false,
      onOrder: false,
    });
  });
});

describe("reset", () => {
  it("restores the sample data exactly and clears the cart", () => {
    const changed = run([
      { type: "add", product: "tea" },
      { type: "checkout", method: "cash" },
      { type: "order-create", supplier: "rossi" },
      { type: "add", product: "pasta" },
    ]);
    expect(changed.data).not.toEqual(seedData());

    const state = reducer(changed, { type: "reset", data: seedData() });

    expect(state.data).toEqual(seedData());
    expect(state.cart).toEqual([]);
    expect(state.notice).toEqual({ kind: "reset" });
  });
});

describe("what comes back from the browser is not trusted", () => {
  it("accepts the sample data and a save of it", () => {
    expect(parseBusinessData(seedData())).toEqual(seedData());
    expect(parseBusinessData(structuredClone(seedData()))).toEqual(seedData());
  });

  it.each([
    ["nothing", undefined],
    ["a string", "{}"],
    ["another version", { ...seedData(), version: 2 }],
    ["an extra field", { ...seedData(), admin: true }],
    [
      "a negative stock",
      { ...seedData(), stock: { ...seedData().stock, tea: -1 } },
    ],
    ["a fractional amount", { ...seedData(), openingBalanceCents: 1.5 }],
    [
      "an unknown product in a sale",
      {
        ...seedData(),
        sales: [
          {
            id: "S-0001",
            date: "2026-06-01",
            method: "cash",
            totalCents: 1,
            lines: [{ product: "gold", qty: 1 }],
          },
        ],
      },
    ],
    [
      "a script in an id",
      {
        ...seedData(),
        orders: [
          {
            id: "<script>",
            supplier: "rossi",
            date: "2026-06-01",
            status: "draft",
            lines: [{ product: "tea", qty: 1, unitCostCents: 1 }],
            receivedDate: null,
          },
        ],
      },
    ],
    [
      "an unknown order status",
      {
        ...seedData(),
        orders: [
          {
            id: "PO-0001",
            supplier: "rossi",
            date: "2026-06-01",
            status: "paid",
            lines: [{ product: "tea", qty: 1, unitCostCents: 1 }],
            receivedDate: null,
          },
        ],
      },
    ],
    ["a malformed date", { ...seedData(), today: "tomorrow" }],
    [
      "an oversized list",
      {
        ...seedData(),
        expenses: Array.from({ length: 501 }, () => seedData().expenses[0]),
      },
    ],
  ])("rejects %s and falls back (negative)", (_name, value) => {
    expect(parseBusinessData(value)).toBeNull();
  });

  it("the memory store hands back only what validates, and clears", async () => {
    const store = createMemoryStore({ not: "a save" });
    expect(await store.load()).toEqual({ status: "ok", data: null });

    const changed = run([
      { type: "add", product: "tea" },
      { type: "checkout", method: "cash" },
    ]).data;
    expect(await store.save(changed)).toBe(true);
    expect(await store.load()).toEqual({ status: "ok", data: changed });
    expect(await store.clear()).toBe(true);
    expect(await store.load()).toEqual({ status: "ok", data: null });
  });

  it("with no IndexedDB the store reports unavailable and never throws", async () => {
    // jsdom has no IndexedDB, like a browser that blocks it.
    const store = createIndexedDbStore();

    expect(await store.load()).toEqual({ status: "unavailable" });
    expect(await store.save(seedData())).toBe(false);
    expect(await store.clear()).toBe(false);
  });
});
