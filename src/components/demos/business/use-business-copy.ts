import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import type { ProductId, SupplierId } from "@/lib/demos/business/fixtures";

type Values = Record<string, string | number>;

/**
 * Words and number formats of the back-office demo. Keys built from a product
 * or supplier id come from the fixtures, not from the visitor, and a test
 * checks that every key exists in both languages, so the one cast here is
 * covered where the compiler cannot see it. Amounts are euro cents; dates are
 * ISO days shown in UTC, so no time zone can move a day.
 */
export function useBusinessCopy() {
  const t = useTranslations("demos.business");
  const locale = useLocale();

  const formats = useMemo(() => {
    const money = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
    });
    const compact = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    });
    const short = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const long = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const at = (iso: string) => new Date(`${iso}T00:00:00Z`);
    return {
      money: (cents: number) => money.format(cents / 100),
      compact: (cents: number) => compact.format(cents / 100),
      date: (iso: string) => short.format(at(iso)),
      dateLong: (iso: string) => long.format(at(iso)),
    };
  }, [locale]);

  const text = (key: string, values?: Values): string =>
    t(key as never, values as never);

  return {
    text,
    ...formats,
    product: (id: ProductId) => text(`items.${id}`),
    supplier: (id: SupplierId) => text(`suppliers.${id}`),
  };
}
