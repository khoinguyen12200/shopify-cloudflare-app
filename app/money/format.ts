import { currencyDecimals } from "./currency";
import type { Money } from "./types";

/**
 * Format money for a locale.
 *
 * Takes a `Money`, so the amount and its currency cannot be passed separately and
 * get out of step. Division by the currency's own scale happens here, once, at
 * the very last moment before display — a float that exists only long enough to
 * be turned into a string cannot accumulate error.
 */
export function formatMoney(locale: string, money: Money): string {
  const decimals = currencyDecimals(money.currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    // Pinned so the output cannot disagree with what was stored: some locales
    // would otherwise drop trailing zeros and render $19.90 as "$19.9".
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(money.amount / 10 ** decimals);
}

/** Just the number, no symbol — for a table column that has its own header. */
export function formatMoneyPlain(locale: string, money: Money): string {
  const decimals = currencyDecimals(money.currency);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(money.amount / 10 ** decimals);
}
