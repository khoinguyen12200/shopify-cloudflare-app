import type { Locale } from "./config";

/**
 * Locale-aware formatting via the platform's `Intl`, which workerd implements
 * natively — no library, no data files.
 *
 * Every function is PURE and takes the locale explicitly: never read an ambient
 * locale here. That is what makes these testable and keeps them in ring 1
 * (@rules/architecture.md).
 *
 * Translating strings is not enough on its own. `1/2/2026` means January 2nd in
 * en and February 1st in es, and `1,5` is one-and-a-half in es but a thousand in
 * en. Formatting a date or number by hand is a localisation bug.
 */

export function formatDate(
  locale: Locale,
  value: Date | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatDateTime(
  locale: Locale,
  value: Date | number,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Money. Takes **integer minor units** and the currency, together — the only
 * representation allowed in this codebase (@rules/code-craft.md). Passing a
 * float here is a bug at the call site.
 */
export function formatMoney(
  locale: Locale,
  minorUnits: number,
  currency: string,
): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });
  // Currencies differ in their number of decimals (JPY has 0, USD 2, KWD 3), so
  // derive the divisor from the locale data rather than assuming 100.
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(minorUnits / 10 ** digits);
}

/** "a, b and c" / "a, b y c" — never join with a hardcoded ", ". */
export function formatList(
  locale: Locale,
  items: readonly string[],
  type: "conjunction" | "disjunction" = "conjunction",
): string {
  return new Intl.ListFormat(locale, { style: "long", type }).format(items);
}

/** "3 days ago" / "hace 3 días". */
export function formatRelativeTime(
  locale: Locale,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    value,
    unit,
  );
}
