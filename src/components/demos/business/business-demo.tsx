"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useReducer, useRef, useState } from "react";

import { useDemoCompleted } from "@/components/demos/demo-funnel";
import { CashflowView } from "@/components/demos/business/cashflow-view";
import { OrdersView } from "@/components/demos/business/orders-view";
import { PosView } from "@/components/demos/business/pos-view";
import { useBusinessCopy } from "@/components/demos/business/use-business-copy";
import { Button } from "@/components/ui/button";
import { businessEngine } from "@/lib/demos/business/engine";
import { assembleSeed, type SeedPart } from "@/lib/demos/business/fixtures";
import {
  initialState,
  reducer,
  views,
  type Notice,
} from "@/lib/demos/business/state";
import {
  createIndexedDbStore,
  type BusinessStore,
} from "@/lib/demos/business/storage";
import { cn } from "@/lib/utils";

const LIMITS = ["local", "synthetic", "rules", "scope"] as const;

type Storage = "checking" | "saved" | "unavailable";

/**
 * Back-office suite, SIMULATION (P3.4): a till, a cash-flow dashboard and
 * purchase orders on one invented shop. The data is generated here from a fixed
 * seed; the visitor's changes are kept in this browser's own IndexedDB (see
 * `storage.ts`) and nowhere else. Nothing is requested from a server, nothing is
 * typed, and "Start over" erases the saved changes and restores the sample.
 *
 * The first render is the sample data (the same on the server and in the
 * browser), so the page reads without JavaScript; the saved changes are loaded
 * right after hydration. If the browser refuses storage the demo still works and
 * says that the changes last only until the page is closed.
 */
export function BusinessDemo({ store }: { store?: BusinessStore } = {}) {
  const t = useTranslations("demos.business");
  const c = useBusinessCopy();
  const locale = useLocale();
  const sessionId = useId();

  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  // Done = a sale was rung up or a purchase order was received (a notice only an action sets).
  useDemoCompleted(
    "business-management-app",
    state.notice?.kind === "sale" || state.notice?.kind === "order-received",
  );
  const [storage, setStorage] = useState<Storage>("checking");
  const active = useRef<BusinessStore | null>(null);
  /** The data last read from or written to storage: a change is saved only when it differs. */
  const persisted = useRef<unknown>(null);
  const ready = useRef(false);

  useEffect(() => {
    const backing = store ?? createIndexedDbStore();
    active.current = backing;
    let cancelled = false;
    void backing.load().then((result) => {
      if (cancelled) return;
      if (result.status === "unavailable") {
        setStorage("unavailable");
      } else {
        if (result.data !== null) {
          persisted.current = result.data;
          dispatch({ type: "hydrate", data: result.data });
        }
        setStorage("saved");
      }
      ready.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (!ready.current || state.data === persisted.current) return;
    persisted.current = state.data;
    void active.current?.save(state.data).then((saved) => {
      if (!saved) setStorage("unavailable");
    });
  }, [state.data]);

  const reset = async () => {
    const parts: SeedPart[] = [];
    for await (const part of businessEngine.run(
      {},
      { sessionId, locale: locale === "en" ? "en" : "it" },
    )) {
      parts.push(part);
    }
    const data = assembleSeed(parts);
    // The sample is what an empty storage means: erase the saved changes instead of saving it.
    persisted.current = data;
    dispatch({ type: "reset", data });
    await active.current?.clear();
  };

  const notice = (n: Notice | null): string => {
    if (n === null) return "";
    switch (n.kind) {
      case "sale":
        return c.text("notice.sale", {
          id: n.id,
          total: c.money(n.totalCents),
        });
      case "limit":
        return c.text("notice.limit", { name: c.product(n.product) });
      case "order-created":
        return c.text("notice.orderCreated", {
          id: n.id,
          supplier: c.supplier(n.supplier),
        });
      case "order-sent":
        return c.text("notice.orderSent", { id: n.id });
      case "order-received":
        return c.text("notice.orderReceived", { id: n.id });
      case "reset":
        return c.text("notice.reset");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-10">
      <div className="grid max-w-3xl gap-3">
        <p className="text-sm text-text-muted">{t("brand")}</p>
        <p className="text-lg text-text-secondary">{t("intro")}</p>
        <p className="text-sm text-text-muted">
          {t("sampleDate", { date: c.dateLong(state.data.today) })}
        </p>
      </div>

      <div
        data-limits=""
        className="grid max-w-5xl gap-3 border border-border-strong p-6"
      >
        <h3 className="text-xl text-text">{t("limits.title")}</h3>
        <ul className="grid list-disc gap-2 ps-5 text-base text-text-secondary">
          {LIMITS.map((key) => (
            <li key={key}>{t(`limits.${key}`)}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div
          role="group"
          aria-label={t("tabs.label")}
          className="flex flex-wrap gap-2"
        >
          {views.map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={state.view === view}
              onClick={() => {
                dispatch({ type: "view", view });
              }}
              className={cn(
                "min-h-11 border px-4 py-2 text-base text-text",
                state.view === view
                  ? "border-accent bg-surface-2"
                  : "border-border-strong hover:border-accent",
              )}
            >
              {t(`tabs.${view}`)}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void reset();
          }}
        >
          <ResetLabel />
        </Button>
      </div>

      <div className="grid gap-1">
        <p
          role="status"
          aria-live="polite"
          data-notice=""
          className="min-h-6 text-base text-text"
        >
          {notice(state.notice)}
        </p>
        <p data-storage={storage} className="text-sm text-text-muted">
          {t(`storage.${storage}`)}
        </p>
      </div>

      {state.view === "pos" ? (
        <section aria-labelledby="bm-pos-title" className="grid gap-6">
          <h3 id="bm-pos-title" className="text-3xl text-text">
            {t("pos.title")}
          </h3>
          <PosView state={state} dispatch={dispatch} />
        </section>
      ) : null}
      {state.view === "cashflow" ? (
        <section aria-labelledby="bm-cash-title" className="grid gap-6">
          <h3 id="bm-cash-title" className="text-3xl text-text">
            {t("cash.title")}
          </h3>
          <CashflowView data={state.data} />
        </section>
      ) : null}
      {state.view === "orders" ? (
        <section aria-labelledby="bm-orders-main-title" className="grid gap-6">
          <h3 id="bm-orders-main-title" className="text-3xl text-text">
            {t("orders.title")}
          </h3>
          <OrdersView state={state} dispatch={dispatch} />
        </section>
      ) : null}
    </div>
  );
}

function ResetLabel() {
  const t = useTranslations("demos.shell");
  return <>{t("reset")}</>;
}
