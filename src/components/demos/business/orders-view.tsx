import type { Dispatch } from "react";

import { ScrollRegion } from "@/components/demos/business/scroll-region";
import { useBusinessCopy } from "@/components/demos/business/use-business-copy";
import { Button } from "@/components/ui/button";
import { supplierIds, type PurchaseOrder } from "@/lib/demos/business/fixtures";
import {
  orderTotal,
  stockRows,
  suggestedLines,
} from "@/lib/demos/business/model";
import type { DemoAction, State } from "@/lib/demos/business/state";
import { cn } from "@/lib/utils";

/** Left bar per order status: a token, never the only signal (the status is written out). */
const TONE = {
  draft: "border-l-border-strong",
  sent: "border-l-warning",
  received: "border-l-accent",
} as const;

function OrderCard({
  order,
  dispatch,
}: {
  order: PurchaseOrder;
  dispatch: Dispatch<DemoAction>;
}) {
  const c = useBusinessCopy();
  return (
    <li
      data-order={order.id}
      data-status={order.status}
      className={cn(
        "grid gap-3 border border-l-4 border-border-strong px-4 py-3",
        TONE[order.status],
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="text-lg text-text">
          <span className="font-mono">{order.id}</span>
          {" · "}
          {c.supplier(order.supplier)}
        </h4>
        <span data-order-status="" className="text-sm text-text">
          {c.text(`orders.status.${order.status}`)}
        </span>
      </div>
      <ul
        aria-label={c.text("orders.list.lines", { id: order.id })}
        className="grid gap-1 text-base text-text-secondary"
      >
        {order.lines.map((line) => (
          <li key={line.product}>
            {c.text("orders.list.line", {
              qty: line.qty,
              name: c.product(line.product),
            })}
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-secondary">
        {order.receivedDate === null
          ? c.text("orders.list.ordered", { date: c.dateLong(order.date) })
          : c.text("orders.list.receivedOn", {
              date: c.dateLong(order.receivedDate),
            })}
        {" · "}
        {c.text("orders.list.total")}{" "}
        <span className="font-mono text-text">
          {c.money(orderTotal(order))}
        </span>
      </p>
      {order.status === "draft" ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            aria-label={c.text("orders.list.sendLabel", { id: order.id })}
            onClick={() => {
              dispatch({ type: "order-send", id: order.id });
            }}
          >
            {c.text("orders.list.send")}
          </Button>
        </div>
      ) : null}
      {order.status === "sent" ? (
        <div>
          <Button
            type="button"
            aria-label={c.text("orders.list.receiveLabel", { id: order.id })}
            onClick={() => {
              dispatch({ type: "order-receive", id: order.id });
            }}
          >
            {c.text("orders.list.receive")}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Purchase orders: which products are low, one button per supplier to draft the
 * reorder, and the orders themselves moving draft → sent → received. Only
 * receiving an order changes the stock and books the money out.
 */
export function OrdersView({
  state,
  dispatch,
}: {
  state: State;
  dispatch: Dispatch<DemoAction>;
}) {
  const c = useBusinessCopy();
  const { data } = state;
  const rows = stockRows(data);
  const orders = [...data.orders].reverse();

  return (
    <div className="grid grid-cols-1 gap-10">
      <p className="max-w-3xl text-lg text-text-secondary">
        {c.text("orders.intro")}
      </p>

      <section
        aria-labelledby="bm-reorder-title"
        className="grid content-start gap-4"
      >
        <h3 id="bm-reorder-title" className="text-2xl text-text">
          {c.text("orders.reorder.title")}
        </h3>
        <ul className="grid gap-2 md:grid-cols-3">
          {supplierIds.map((supplier) => {
            const lines = suggestedLines(data, supplier);
            const name = c.supplier(supplier);
            return (
              <li
                key={supplier}
                data-supplier={supplier}
                className="grid content-start gap-2 border border-border-strong p-4"
              >
                <span className="font-medium text-text">{name}</span>
                <span className="text-sm text-text-secondary">
                  {lines.length === 0
                    ? c.text("orders.reorder.nothing")
                    : c.text("orders.reorder.lowCount", {
                        count: lines.length,
                      })}
                </span>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={lines.length === 0}
                    aria-label={c.text("orders.reorder.createLabel", {
                      supplier: name,
                    })}
                    onClick={() => {
                      dispatch({ type: "order-create", supplier });
                    }}
                  >
                    {c.text("orders.reorder.create")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section
          aria-labelledby="bm-orders-title"
          className="grid content-start gap-4"
        >
          <h3 id="bm-orders-title" className="text-2xl text-text">
            {c.text("orders.list.title")}
          </h3>
          <ul className="grid gap-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} dispatch={dispatch} />
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="bm-stock-title"
          className="grid content-start gap-4"
        >
          <h3 id="bm-stock-title" className="text-2xl text-text">
            {c.text("orders.stock.title")}
          </h3>
          <ScrollRegion label={c.text("orders.stock.caption")}>
            <table data-stock-table="" className="w-full text-base">
              <caption className="sr-only">
                {c.text("orders.stock.caption")}
              </caption>
              <thead>
                <tr className="border-b border-border-strong text-sm text-text-muted">
                  <th scope="col" className="py-2 pe-3 text-start font-normal">
                    {c.text("orders.stock.product")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-end font-normal">
                    {c.text("orders.stock.shelf")}
                  </th>
                  <th scope="col" className="py-2 pe-3 text-end font-normal">
                    {c.text("orders.stock.level")}
                  </th>
                  <th scope="col" className="py-2 text-start font-normal">
                    {c.text("orders.stock.state")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.product}
                    data-stock-row={row.product}
                    className="border-b border-border-subtle"
                  >
                    <th
                      scope="row"
                      className="py-2 pe-3 text-start font-normal text-text"
                    >
                      {c.product(row.product)}
                    </th>
                    <td
                      data-shelf=""
                      className="py-2 pe-3 text-end font-mono text-text"
                    >
                      {row.stock}
                    </td>
                    <td className="py-2 pe-3 text-end font-mono text-text-secondary">
                      {row.reorderLevel}
                    </td>
                    <td data-state="" className="py-2 text-text">
                      {row.low && !row.onOrder
                        ? c.text("orders.stock.low")
                        : row.onOrder
                          ? c.text("orders.stock.onOrder")
                          : c.text("orders.stock.ok")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
        </section>
      </div>
    </div>
  );
}
