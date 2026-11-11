import { Minus, Plus, Trash2 } from "lucide-react";
import type { Dispatch } from "react";

import { ScrollRegion } from "@/components/demos/business/scroll-region";
import { useBusinessCopy } from "@/components/demos/business/use-business-copy";
import { Button } from "@/components/ui/button";
import {
  paymentMethods,
  products,
  type Sale,
} from "@/lib/demos/business/fixtures";
import { cartTotal, vatIncluded, lineTotal } from "@/lib/demos/business/model";
import {
  available,
  type DemoAction,
  type State,
} from "@/lib/demos/business/state";
import { cn } from "@/lib/utils";

const RECENT = 5;

const itemCount = (sale: Sale) =>
  sale.lines.reduce((sum, line) => sum + line.qty, 0);

/**
 * The till: the products on the shelf, the sale being rung up, and the latest
 * sales. The only inputs are buttons (add, one more, one less, remove, pay
 * cash or card): nothing is typed, so no personal data can enter the demo.
 */
export function PosView({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<DemoAction>;
}) {
  const c = useBusinessCopy();
  const { cart, data } = state;
  const total = cartTotal(cart);
  const recent = data.sales.slice(-RECENT).reverse();

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <section
        aria-labelledby="bm-products-title"
        className="grid content-start gap-4"
      >
        <h3 id="bm-products-title" className="text-2xl text-text">
          {c.text("pos.products")}
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {products.map((product) => {
            const left = available(state, product.id);
            const name = c.product(product.id);
            const inSale = data.stock[product.id] - left;
            return (
              <li
                key={product.id}
                data-product={product.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border border-border-strong px-4 py-3"
              >
                <span className="font-medium text-text">{name}</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="row-span-2"
                  disabled={left <= 0}
                  aria-label={c.text("pos.addLabel", { name })}
                  onClick={() => {
                    dispatch({ type: "add", product: product.id });
                  }}
                >
                  {c.text("pos.add")}
                </Button>
                <span className="text-sm text-text-secondary">
                  <span className="font-mono text-text">
                    {c.money(product.priceCents)}
                  </span>
                  {" · "}
                  <span data-stock="">
                    {data.stock[product.id] === 0
                      ? c.text("pos.soldOut")
                      : c.text("pos.inStock", {
                          count: data.stock[product.id],
                        })}
                  </span>
                  {inSale > 0
                    ? ` · ${c.text("pos.inSale", { count: inSale })}`
                    : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section
        aria-labelledby="bm-cart-title"
        className="grid content-start gap-4 border border-border-strong p-5"
      >
        <h3 id="bm-cart-title" className="text-2xl text-text">
          {c.text("pos.cart.title")}
        </h3>
        {cart.length === 0 ? (
          <p data-cart-empty="" className="text-base text-text-secondary">
            {c.text("pos.cart.empty")}
          </p>
        ) : (
          <ul className="grid gap-3">
            {cart.map((line) => {
              const name = c.product(line.product);
              return (
                <li
                  key={line.product}
                  data-cart-line={line.product}
                  className="grid gap-2 border-b border-border-subtle pb-3"
                >
                  <span className="text-text">{name}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={c.text("pos.cart.less", { name })}
                      onClick={() => {
                        dispatch({
                          type: "step",
                          product: line.product,
                          by: -1,
                        });
                      }}
                    >
                      <Minus aria-hidden="true" />
                    </Button>
                    <span
                      data-qty=""
                      className="min-w-8 text-center font-mono text-text"
                    >
                      {line.qty}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      aria-label={c.text("pos.cart.more", { name })}
                      onClick={() => {
                        dispatch({
                          type: "step",
                          product: line.product,
                          by: 1,
                        });
                      }}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      size="icon"
                      aria-label={c.text("pos.cart.remove", { name })}
                      onClick={() => {
                        dispatch({ type: "remove", product: line.product });
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                    <span className="ms-auto font-mono text-text">
                      {c.money(lineTotal(line))}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="grid gap-1 text-base">
          <div className="flex justify-between gap-4">
            <dt className="text-text-secondary">{c.text("pos.cart.vat")}</dt>
            <dd className="font-mono text-text-secondary">
              {c.money(vatIncluded(total))}
            </dd>
          </div>
          <div className="flex justify-between gap-4 text-xl">
            <dt className="text-text">{c.text("pos.cart.total")}</dt>
            <dd data-cart-total="" className="font-mono text-text">
              {c.money(total)}
            </dd>
          </div>
        </dl>

        <div className="grid gap-2">
          <p className="text-sm text-text-muted">{c.text("pos.pay.title")}</p>
          <div className="flex flex-wrap gap-2">
            {paymentMethods.map((method) => (
              <Button
                key={method}
                type="button"
                variant={method === "card" ? "primary" : "secondary"}
                disabled={cart.length === 0}
                onClick={() => {
                  dispatch({ type: "checkout", method });
                }}
              >
                {c.text(`pos.pay.${method}`)}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="bm-recent-title"
        className={cn("grid content-start gap-3", "lg:col-span-2")}
      >
        <h3 id="bm-recent-title" className="text-2xl text-text">
          {c.text("pos.recent.title")}
        </h3>
        <ScrollRegion label={c.text("pos.recent.caption")}>
          <table data-recent-sales="" className="w-full text-start text-base">
            <caption className="sr-only">
              {c.text("pos.recent.caption")}
            </caption>
            <thead>
              <tr className="border-b border-border-strong text-sm text-text-muted">
                <th scope="col" className="py-2 pe-4 text-start font-normal">
                  {c.text("pos.recent.no")}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-normal">
                  {c.text("pos.recent.date")}
                </th>
                <th scope="col" className="py-2 pe-4 text-end font-normal">
                  {c.text("pos.recent.items")}
                </th>
                <th scope="col" className="py-2 pe-4 text-start font-normal">
                  {c.text("pos.recent.method")}
                </th>
                <th scope="col" className="py-2 text-end font-normal">
                  {c.text("pos.recent.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {recent.map((sale) => (
                <tr
                  key={sale.id}
                  data-sale={sale.id}
                  className="border-b border-border-subtle"
                >
                  <th
                    scope="row"
                    className="py-2 pe-4 text-start font-mono font-normal text-text"
                  >
                    {sale.id}
                  </th>
                  <td className="py-2 pe-4 text-text-secondary">
                    {c.date(sale.date)}
                  </td>
                  <td className="py-2 pe-4 text-end font-mono text-text-secondary">
                    {itemCount(sale)}
                  </td>
                  <td className="py-2 pe-4 text-text-secondary">
                    {c.text(`pos.recent.${sale.method}`)}
                  </td>
                  <td className="py-2 text-end font-mono text-text">
                    {c.money(sale.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollRegion>
      </section>
    </div>
  );
}
