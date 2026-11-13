/**
 * Plain `{name}` substitution for the few messages that are only that, shown on
 * a page's first render (P4.7).
 *
 * Why not `t("key", values)`: next-intl formats any message that takes values
 * with the full ICU engine (parser, locale data, ~50 kB of script and over
 * 100 ms of blocking time on a slow phone, measured with Lighthouse on the
 * contact page). For a message that is only text and `{name}` slots that cost
 * buys nothing. Use `fillPlaceholders(t.raw("key"), values)` there.
 *
 * Only for such messages: no plural, select, number or date arguments, no
 * `<tag>` markup, no apostrophes (ICU treats `'` as an escape, this does not).
 * `placeholders.test.ts` fails if a message that goes through here gains any of
 * those, in either language.
 */
export function fillPlaceholders(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  // One pass over the template: a value that itself contains "{x}" is not expanded again.
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}
