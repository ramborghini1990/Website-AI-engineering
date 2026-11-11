import type { Value } from "@/lib/demos/docintel/extract";

/**
 * How an extracted value is shown. The document keeps its own notation
 * ("€ 1.220,00", "14/03/2026"); the extracted view normalises it and writes it
 * the way the visitor's language does, which is what extraction is for.
 */
export function formatValue(value: Value, locale: string): string {
  switch (value.kind) {
    case "text":
      return value.text;
    case "money":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
      }).format(value.cents / 100);
    case "date":
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${value.iso}T00:00:00Z`));
    case "percent":
      return `${String(value.n)}%`;
    case "number":
      return value.unit === undefined
        ? new Intl.NumberFormat(locale).format(value.n)
        : new Intl.NumberFormat(locale, {
            style: "unit",
            unit: value.unit,
            unitDisplay: "long",
          }).format(value.n);
  }
}
