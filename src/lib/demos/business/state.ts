import {
  paymentMethods,
  padId,
  productIds,
  seedData,
  supplierIds,
  type BusinessData,
  type PaymentMethod,
  type ProductId,
  type Sale,
  type SaleLine,
  type SupplierId,
} from "@/lib/demos/business/fixtures";
import { cartTotal, suggestedLines } from "@/lib/demos/business/model";

/**
 * The state of the demo as a pure reducer, so the rules that matter are tested
 * without a browser:
 *  - a sale can never take more than what is on the shelf, and ringing it up
 *    lowers the stock and adds money in;
 *  - a purchase order only moves forward (draft, sent, received); receiving it
 *    is what raises the stock and books the money out;
 *  - nothing here takes text from the visitor: only a product, a quantity step,
 *    a payment method or an order to move on, all from fixed lists.
 */

export const views = ["pos", "cashflow", "orders"] as const;
type View = (typeof views)[number];

/** What the visitor just did, as data (the page words it in the visitor's language). */
export type Notice =
  | { kind: "sale"; id: string; totalCents: number }
  | { kind: "limit"; product: ProductId }
  | { kind: "order-created"; id: string; supplier: SupplierId }
  | { kind: "order-sent"; id: string }
  | { kind: "order-received"; id: string }
  | { kind: "reset" };

export type State = {
  data: BusinessData;
  cart: SaleLine[];
  view: View;
  notice: Notice | null;
};

export type DemoAction =
  | { type: "hydrate"; data: BusinessData }
  | { type: "view"; view: View }
  | { type: "add"; product: ProductId }
  | { type: "step"; product: ProductId; by: 1 | -1 }
  | { type: "remove"; product: ProductId }
  | { type: "checkout"; method: PaymentMethod }
  | { type: "order-create"; supplier: SupplierId }
  | { type: "order-send"; id: string }
  | { type: "order-receive"; id: string }
  | { type: "reset"; data: BusinessData };

export function initialState(): State {
  return { data: seedData(), cart: [], view: "pos", notice: null };
}

const nextNumber = (ids: readonly string[]): number =>
  ids.reduce((max, id) => Math.max(max, Number(id.split("-")[1] ?? 0)), 0) + 1;

const inCart = (cart: readonly SaleLine[], product: ProductId): number =>
  cart.find((line) => line.product === product)?.qty ?? 0;

export function reducer(state: State, action: DemoAction): State {
  const { data, cart } = state;
  switch (action.type) {
    case "hydrate":
      return { ...state, data: action.data, cart: [], notice: null };
    case "reset":
      return {
        ...state,
        data: action.data,
        cart: [],
        notice: { kind: "reset" },
      };
    case "view":
      return views.includes(action.view)
        ? { ...state, view: action.view, notice: null }
        : state;
    case "add": {
      if (!productIds.includes(action.product)) return state;
      const wanted = inCart(cart, action.product) + 1;
      if (wanted > data.stock[action.product]) {
        return { ...state, notice: { kind: "limit", product: action.product } };
      }
      const next = cart.some((line) => line.product === action.product)
        ? cart.map((line) =>
            line.product === action.product ? { ...line, qty: wanted } : line,
          )
        : [...cart, { product: action.product, qty: 1 }];
      return { ...state, cart: next, notice: null };
    }
    case "step": {
      const current = inCart(cart, action.product);
      if (current === 0) return state;
      const wanted = current + action.by;
      if (wanted > data.stock[action.product]) {
        return { ...state, notice: { kind: "limit", product: action.product } };
      }
      return {
        ...state,
        cart:
          wanted <= 0
            ? cart.filter((line) => line.product !== action.product)
            : cart.map((line) =>
                line.product === action.product
                  ? { ...line, qty: wanted }
                  : line,
              ),
        notice: null,
      };
    }
    case "remove":
      return {
        ...state,
        cart: cart.filter((line) => line.product !== action.product),
        notice: null,
      };
    case "checkout": {
      if (cart.length === 0 || !paymentMethods.includes(action.method)) {
        return state;
      }
      // The cart is checked against the shelf again: a sale never makes stock negative.
      if (cart.some((line) => line.qty > data.stock[line.product]))
        return state;
      const sale: Sale = {
        id: padId("S", nextNumber(data.sales.map((s) => s.id))),
        date: data.today,
        method: action.method,
        totalCents: cartTotal(cart),
        lines: cart,
      };
      const stock = { ...data.stock };
      for (const line of cart) stock[line.product] -= line.qty;
      return {
        ...state,
        data: { ...data, stock, sales: [...data.sales, sale] },
        cart: [],
        notice: { kind: "sale", id: sale.id, totalCents: sale.totalCents },
      };
    }
    case "order-create": {
      if (!supplierIds.includes(action.supplier)) return state;
      const lines = suggestedLines(data, action.supplier);
      if (lines.length === 0) return state; // nothing to reorder, or already on order
      const id = padId("PO", nextNumber(data.orders.map((o) => o.id)));
      return {
        ...state,
        data: {
          ...data,
          orders: [
            ...data.orders,
            {
              id,
              supplier: action.supplier,
              date: data.today,
              status: "draft",
              lines,
              receivedDate: null,
            },
          ],
        },
        notice: { kind: "order-created", id, supplier: action.supplier },
      };
    }
    case "order-send": {
      const order = data.orders.find((o) => o.id === action.id);
      if (order?.status !== "draft") return state;
      return {
        ...state,
        data: {
          ...data,
          orders: data.orders.map((o) =>
            o.id === action.id ? { ...o, status: "sent" } : o,
          ),
        },
        notice: { kind: "order-sent", id: action.id },
      };
    }
    case "order-receive": {
      const order = data.orders.find((o) => o.id === action.id);
      // Only a sent order can arrive: a draft was never sent, a received one cannot arrive twice.
      if (order?.status !== "sent") return state;
      const stock = { ...data.stock };
      for (const line of order.lines) {
        stock[line.product] += line.qty;
      }
      return {
        ...state,
        data: {
          ...data,
          stock,
          orders: data.orders.map((o) =>
            o.id === action.id
              ? { ...o, status: "received", receivedDate: data.today }
              : o,
          ),
        },
        notice: { kind: "order-received", id: action.id },
      };
    }
  }
}

/** Units of a product still available for this sale (shelf minus what is in the cart). */
export const available = (state: State, product: ProductId): number =>
  state.data.stock[product] - inCart(state.cart, product);
