import { z } from "zod";

import {
  expenseKinds,
  orderStatuses,
  paymentMethods,
  productIds,
  supplierIds,
  type BusinessData,
  type ProductId,
} from "@/lib/demos/business/fixtures";

/**
 * The only place in the demo code that touches browser storage, and the only
 * storage the demos may use: one IndexedDB database in the visitor's own
 * browser (`demo-business-suite`), holding the sample business and the
 * visitor's changes to it. Nothing is sent anywhere; the demo works the same
 * with no storage at all (the data then lasts until the page is closed).
 *
 * What comes back from the browser is NOT trusted: another script or the
 * visitor's own tools could have changed it, so it is parsed with a strict
 * schema with size caps, and anything that does not fit is discarded in favour
 * of the sample data.
 */

// The site's CSP has no 'unsafe-eval', and Zod's fast path compiles its parsers with `new Function`,
// which the browser reports as a violation before Zod falls back. Parsing a small save does not need it.
z.config({ jitless: true });

const DB_NAME = "demo-business-suite";
const STORE = "state";
const KEY = "data";
const DB_VERSION = 1;

const cents = z.number().int().min(0).max(100_000_000);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().regex(/^[A-Z]{1,2}-\d{4,6}$/);
const product = z.enum(productIds);
const qty = z.number().int().min(1).max(10_000);

const schema = z.strictObject({
  version: z.literal(1),
  today: day,
  startDate: day,
  openingBalanceCents: cents,
  stock: z.strictObject(
    Object.fromEntries(
      productIds.map((p) => [p, z.number().int().min(0).max(100_000)]),
    ) as Record<ProductId, z.ZodNumber>,
  ),
  sales: z
    .array(
      z.strictObject({
        id,
        date: day,
        method: z.enum(paymentMethods),
        totalCents: cents,
        lines: z.array(z.strictObject({ product, qty })).min(1).max(20),
      }),
    )
    .max(5000),
  expenses: z
    .array(
      z.strictObject({
        id,
        date: day,
        kind: z.enum(expenseKinds),
        amountCents: cents,
      }),
    )
    .max(500),
  orders: z
    .array(
      z.strictObject({
        id,
        supplier: z.enum(supplierIds),
        date: day,
        status: z.enum(orderStatuses),
        lines: z
          .array(z.strictObject({ product, qty, unitCostCents: cents }))
          .min(1)
          .max(20),
        receivedDate: day.nullable(),
      }),
    )
    .max(500),
});

/** The stored value if it is a valid save of the demo, otherwise null. */
export function parseBusinessData(input: unknown): BusinessData | null {
  const parsed = schema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

type LoadResult =
  { status: "ok"; data: BusinessData | null } | { status: "unavailable" };

/** Where the demo keeps its data. No method ever throws: a failure is reported in the result. */
export type BusinessStore = {
  load(): Promise<LoadResult>;
  save(data: BusinessData): Promise<boolean>;
  clear(): Promise<boolean>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(new Error("indexeddb open failed"));
    };
    request.onblocked = () => {
      reject(new Error("indexeddb blocked"));
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("indexeddb transaction failed"));
    };
  });
}

/** The IndexedDB store. Where IndexedDB does not exist or refuses (some private modes), it reports "unavailable". */
export function createIndexedDbStore(): BusinessStore {
  // Merely reading `indexedDB` can throw (a browser that blocks site data), so even that is guarded.
  const supported = (() => {
    try {
      return typeof indexedDB !== "undefined";
    } catch {
      return false;
    }
  })();
  return {
    async load() {
      if (!supported) return { status: "unavailable" };
      try {
        const stored = await withStore<unknown>("readonly", (store) =>
          store.get(KEY),
        );
        return { status: "ok", data: parseBusinessData(stored) };
      } catch {
        return { status: "unavailable" };
      }
    },
    async save(data) {
      if (!supported) return false;
      try {
        await withStore("readwrite", (store) => store.put(data, KEY));
        return true;
      } catch {
        return false;
      }
    },
    async clear() {
      if (!supported) return false;
      try {
        await withStore("readwrite", (store) => store.delete(KEY));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** A store that keeps the data in memory only: for tests, and a stand-in anywhere the real one cannot run. */
export function createMemoryStore(initial?: unknown): BusinessStore {
  let value: unknown = initial;
  return {
    load: () =>
      Promise.resolve({ status: "ok", data: parseBusinessData(value) }),
    save: (data) => {
      value = structuredClone(data);
      return Promise.resolve(true);
    },
    clear: () => {
      value = undefined;
      return Promise.resolve(true);
    },
  };
}
