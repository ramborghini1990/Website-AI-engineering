import {
  addDays,
  productById,
  products,
  VAT_PERCENT,
  type BusinessData,
  type OrderLine,
  type ProductId,
  type PurchaseOrder,
  type SaleLine,
  type SupplierId,
} from "@/lib/demos/business/fixtures";

/**
 * The business rules of the back-office demo as pure functions, so what matters
 * (VAT, stock, what counts as money in and out, which products need
 * reordering) is tested without a browser. All amounts are integer cents.
 */

export const lineTotal = (line: SaleLine): number =>
  productById(line.product).priceCents * line.qty;

export const cartTotal = (cart: readonly SaleLine[]): number =>
  cart.reduce((sum, line) => sum + lineTotal(line), 0);

/** The VAT contained in a VAT-inclusive total (shelf prices include it). */
export const vatIncluded = (totalCents: number): number =>
  Math.round((totalCents * VAT_PERCENT) / (100 + VAT_PERCENT));

export const orderTotal = (order: Pick<PurchaseOrder, "lines">): number =>
  order.lines.reduce((sum, l) => sum + l.unitCostCents * l.qty, 0);

const isOpen = (order: PurchaseOrder) => order.status !== "received";

// ── cash flow ──

type Flow = { inCents: number; outCents: number };

/**
 * Money in and out per day. In: every sale, on the day it is rung up (cash and
 * card alike: the demo does not model card settlement delays). Out: expenses
 * on their day, and a purchase order on the day it is received (paid on
 * delivery); a draft or sent order costs nothing yet.
 */
function flowsByDay(data: BusinessData): Map<string, Flow> {
  const days = new Map<string, Flow>();
  const at = (date: string): Flow => {
    const found = days.get(date);
    if (found) return found;
    const created = { inCents: 0, outCents: 0 };
    days.set(date, created);
    return created;
  };
  for (const sale of data.sales) at(sale.date).inCents += sale.totalCents;
  for (const expense of data.expenses) {
    at(expense.date).outCents += expense.amountCents;
  }
  for (const order of data.orders) {
    if (order.status === "received" && order.receivedDate !== null) {
      at(order.receivedDate).outCents += orderTotal(order);
    }
  }
  return days;
}

export type BalancePoint = { date: string; balanceCents: number };

/** The closing balance of each of the last `days` days, oldest first. */
export function balanceSeries(data: BusinessData, days = 30): BalancePoint[] {
  const flows = flowsByDay(data);
  let balance = data.openingBalanceCents;
  const points: BalancePoint[] = [];
  const first = addDays(data.today, -(days - 1));
  for (let date = data.startDate; date <= data.today; date = addDays(date, 1)) {
    const flow = flows.get(date);
    balance += (flow?.inCents ?? 0) - (flow?.outCents ?? 0);
    if (date >= first) points.push({ date, balanceCents: balance });
  }
  return points;
}

export type WeekFlow = {
  /** Last day of the 7-day bucket. */
  end: string;
  inCents: number;
  outCents: number;
};

/** Money in and out per 7-day bucket ending today, oldest first. */
export function weeklyFlows(data: BusinessData, weeks = 8): WeekFlow[] {
  const flows = flowsByDay(data);
  const buckets: WeekFlow[] = [];
  for (let w = weeks - 1; w >= 0; w -= 1) {
    const end = addDays(data.today, -7 * w);
    let inCents = 0;
    let outCents = 0;
    for (let d = 0; d < 7; d += 1) {
      const flow = flows.get(addDays(end, -d));
      inCents += flow?.inCents ?? 0;
      outCents += flow?.outCents ?? 0;
    }
    buckets.push({ end, inCents, outCents });
  }
  return buckets;
}

export type Kpis = {
  balanceCents: number;
  /** Last 30 days. */
  inCents: number;
  outCents: number;
  /** Value of the orders not received yet (draft and sent). */
  openOrdersCents: number;
};

export function kpis(data: BusinessData): Kpis {
  const series = balanceSeries(data, 30);
  const flows = flowsByDay(data);
  let inCents = 0;
  let outCents = 0;
  for (let d = 0; d < 30; d += 1) {
    const flow = flows.get(addDays(data.today, -d));
    inCents += flow?.inCents ?? 0;
    outCents += flow?.outCents ?? 0;
  }
  return {
    balanceCents: series.at(-1)?.balanceCents ?? data.openingBalanceCents,
    inCents,
    outCents,
    openOrdersCents: data.orders
      .filter(isOpen)
      .reduce((sum, order) => sum + orderTotal(order), 0),
  };
}

// ── stock and purchasing ──

export type StockRow = {
  product: ProductId;
  supplier: SupplierId;
  stock: number;
  reorderLevel: number;
  /** Below its reorder level. */
  low: boolean;
  /** Already on a draft or sent order. */
  onOrder: boolean;
};

export function stockRows(data: BusinessData): StockRow[] {
  const ordered = new Set(
    data.orders
      .filter(isOpen)
      .flatMap((order) => order.lines.map((l) => l.product)),
  );
  return products.map((product) => {
    const stock = data.stock[product.id];
    return {
      product: product.id,
      supplier: product.supplier,
      stock,
      reorderLevel: product.reorderLevel,
      low: stock < product.reorderLevel,
      onOrder: ordered.has(product.id),
    };
  });
}

/** The lines a new order to this supplier would ask for: low products not already on an open order. */
export function suggestedLines(
  data: BusinessData,
  supplier: SupplierId,
): OrderLine[] {
  return stockRows(data)
    .filter((row) => row.supplier === supplier && row.low && !row.onOrder)
    .map((row) => {
      const product = productById(row.product);
      return {
        product: product.id,
        qty: product.reorderQty,
        unitCostCents: product.costCents,
      };
    });
}
