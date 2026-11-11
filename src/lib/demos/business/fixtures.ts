/**
 * The sample business of the back-office demo (P3.4): "Emporio Rivalta", an
 * invented neighbourhood grocery and household shop. Everything here is made
 * up and generated from a fixed seed, so every visitor (and every test) starts
 * from the same numbers. The words (product and supplier names) live in the
 * messages (`demos.business.items` / `.suppliers`) so they exist in both
 * languages. Money is always integer euro cents.
 */

/** The demo's "today". Fixed on purpose: the sample data and its charts never drift. */
export const DEMO_TODAY = "2026-06-15";
/** How many days of history the sample data covers, ending on `DEMO_TODAY`. */
export const WINDOW_DAYS = 60;
/** Shelf prices include VAT at this rate (Italian ordinary rate). */
export const VAT_PERCENT = 22;

export const productIds = [
  "coffee",
  "pasta",
  "oil",
  "rice",
  "biscuits",
  "detergent",
  "soap",
  "tea",
] as const;
export type ProductId = (typeof productIds)[number];

export const supplierIds = ["rossi", "verde", "alpina"] as const;
export type SupplierId = (typeof supplierIds)[number];

export type Product = {
  id: ProductId;
  supplier: SupplierId;
  /** Shelf price, VAT included. */
  priceCents: number;
  /** What the shop pays the supplier, VAT excluded. */
  costCents: number;
  /** Below this many on the shelf the product needs reordering. */
  reorderLevel: number;
  /** How many a reorder asks for. */
  reorderQty: number;
  /** Units on the shelf in the sample data. */
  startStock: number;
};

export const products: readonly Product[] = [
  {
    id: "coffee",
    supplier: "rossi",
    priceCents: 549,
    costCents: 310,
    reorderLevel: 15,
    reorderQty: 40,
    startStock: 12,
  },
  {
    id: "pasta",
    supplier: "rossi",
    priceCents: 189,
    costCents: 95,
    reorderLevel: 30,
    reorderQty: 60,
    startStock: 64,
  },
  {
    id: "oil",
    supplier: "verde",
    priceCents: 899,
    costCents: 560,
    reorderLevel: 12,
    reorderQty: 24,
    startStock: 21,
  },
  {
    id: "rice",
    supplier: "rossi",
    priceCents: 249,
    costCents: 130,
    reorderLevel: 20,
    reorderQty: 48,
    startStock: 36,
  },
  {
    id: "biscuits",
    supplier: "verde",
    priceCents: 319,
    costCents: 170,
    reorderLevel: 12,
    reorderQty: 36,
    startStock: 9,
  },
  {
    id: "detergent",
    supplier: "alpina",
    priceCents: 479,
    costCents: 270,
    reorderLevel: 10,
    reorderQty: 24,
    startStock: 17,
  },
  {
    id: "soap",
    supplier: "alpina",
    priceCents: 259,
    costCents: 140,
    reorderLevel: 15,
    reorderQty: 36,
    startStock: 28,
  },
  {
    id: "tea",
    supplier: "verde",
    priceCents: 429,
    costCents: 240,
    reorderLevel: 10,
    reorderQty: 30,
    startStock: 8,
  },
];

export const productById = (id: ProductId): Product => {
  const found = products.find((product) => product.id === id);
  if (found === undefined) throw new Error(`unknown product ${id}`);
  return found;
};

export const paymentMethods = ["cash", "card"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type SaleLine = { product: ProductId; qty: number };
export type Sale = {
  id: string;
  date: string;
  method: PaymentMethod;
  /** VAT included. */
  totalCents: number;
  lines: SaleLine[];
};

export const expenseKinds = ["rent", "utilities", "payroll"] as const;
type ExpenseKind = (typeof expenseKinds)[number];
type Expense = {
  id: string;
  date: string;
  kind: ExpenseKind;
  amountCents: number;
};

export const orderStatuses = ["draft", "sent", "received"] as const;
type OrderStatus = (typeof orderStatuses)[number];
export type OrderLine = {
  product: ProductId;
  qty: number;
  unitCostCents: number;
};
export type PurchaseOrder = {
  id: string;
  supplier: SupplierId;
  date: string;
  status: OrderStatus;
  lines: OrderLine[];
  /** The day the goods arrived and were paid for; null until then. */
  receivedDate: string | null;
};

/** Everything the demo stores in the browser. `version` lets a later shape reject an older save. */
export type BusinessData = {
  version: 1;
  /** Fixed day the sample data ends on (`DEMO_TODAY`). */
  today: string;
  /** First day of the sample history. */
  startDate: string;
  /** Cash in the till and bank the evening before `startDate`. */
  openingBalanceCents: number;
  stock: Record<ProductId, number>;
  sales: Sale[];
  expenses: Expense[];
  orders: PurchaseOrder[];
};

// ── dates (ISO `YYYY-MM-DD`, calendar arithmetic in UTC so no time zone can move a day) ──

const DAY_MS = 86_400_000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. */
export const dayOfWeek = (iso: string): number =>
  new Date(toMs(iso)).getUTCDay();

// ── the seed ──

/** Small deterministic generator (mulberry32): the same seed always gives the same sequence. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const SEED = 20_260_615;

export const padId = (prefix: string, n: number) =>
  `${prefix}-${String(n).padStart(4, "0")}`;

function seedSales(): Sale[] {
  const next = random(SEED);
  const sales: Sale[] = [];
  for (let offset = WINDOW_DAYS - 1; offset >= 0; offset -= 1) {
    const date = addDays(DEMO_TODAY, -offset);
    const weekday = dayOfWeek(date);
    if (weekday === 0) continue; // closed on Sundays
    // Saturdays are busy; the demo "today" is only the morning so far.
    const base = 5 + Math.floor(next() * 4) + (weekday === 6 ? 3 : 0);
    const count = offset === 0 ? 2 : base;
    for (let i = 0; i < count; i += 1) {
      const wanted = 1 + Math.floor(next() * 3);
      const pool = [...products];
      const lines: SaleLine[] = [];
      for (let l = 0; l < wanted; l += 1) {
        // At most 3 picks from 8 products: the pool never runs dry.
        const [picked] = pool.splice(Math.floor(next() * pool.length), 1) as [
          Product,
        ];
        lines.push({ product: picked.id, qty: 1 + Math.floor(next() * 3) });
      }
      sales.push({
        id: padId("S", sales.length + 1),
        date,
        method: next() < 0.6 ? "card" : "cash",
        totalCents: lines.reduce(
          (sum, line) => sum + productById(line.product).priceCents * line.qty,
          0,
        ),
        lines,
      });
    }
  }
  return sales;
}

const line = (product: ProductId, qty: number): OrderLine => ({
  product,
  qty,
  unitCostCents: productById(product).costCents,
});

const seedExpenses = (): Expense[] =>
  (
    [
      ["2026-04-27", "payroll", 180_000],
      ["2026-05-01", "rent", 120_000],
      ["2026-05-10", "utilities", 18_400],
      ["2026-05-27", "payroll", 180_000],
      ["2026-06-01", "rent", 120_000],
      ["2026-06-10", "utilities", 17_200],
    ] as const
  ).map(([date, kind, amountCents], index) => ({
    id: padId("E", index + 1),
    date,
    kind,
    amountCents,
  }));

const seedOrders = (): PurchaseOrder[] => [
  {
    id: padId("PO", 1),
    supplier: "rossi",
    date: "2026-05-06",
    status: "received",
    lines: [line("coffee", 40), line("pasta", 60)],
    receivedDate: "2026-05-08",
  },
  {
    id: padId("PO", 2),
    supplier: "verde",
    date: "2026-05-28",
    status: "received",
    lines: [line("oil", 24), line("tea", 30)],
    receivedDate: "2026-05-30",
  },
  {
    id: padId("PO", 3),
    supplier: "alpina",
    date: "2026-06-10",
    status: "sent",
    lines: [line("detergent", 24), line("soap", 36)],
    receivedDate: null,
  },
  {
    id: padId("PO", 4),
    supplier: "rossi",
    date: "2026-06-14",
    status: "draft",
    lines: [line("rice", 48)],
    receivedDate: null,
  },
];

/** One collection of the sample data: the unit the demo engine streams. */
export type SeedPart =
  | { part: "stock"; stock: Record<ProductId, number> }
  | { part: "sales"; sales: Sale[] }
  | { part: "expenses"; expenses: Expense[] }
  | { part: "orders"; orders: PurchaseOrder[] };

export function seedParts(): SeedPart[] {
  return [
    {
      part: "stock",
      stock: Object.fromEntries(
        products.map((product) => [product.id, product.startStock]),
      ) as Record<ProductId, number>,
    },
    { part: "sales", sales: seedSales() },
    { part: "expenses", expenses: seedExpenses() },
    { part: "orders", orders: seedOrders() },
  ];
}

/** Puts the streamed parts together. A part that never came leaves that collection empty. */
export function assembleSeed(parts: readonly SeedPart[]): BusinessData {
  const data: BusinessData = {
    version: 1,
    today: DEMO_TODAY,
    startDate: addDays(DEMO_TODAY, -(WINDOW_DAYS - 1)),
    openingBalanceCents: 600_000,
    stock: Object.fromEntries(productIds.map((id) => [id, 0])) as Record<
      ProductId,
      number
    >,
    sales: [],
    expenses: [],
    orders: [],
  };
  for (const part of parts) {
    if (part.part === "stock") data.stock = part.stock;
    else if (part.part === "sales") data.sales = part.sales;
    else if (part.part === "expenses") data.expenses = part.expenses;
    else data.orders = part.orders;
  }
  return data;
}

export const seedData = (): BusinessData => assembleSeed(seedParts());
