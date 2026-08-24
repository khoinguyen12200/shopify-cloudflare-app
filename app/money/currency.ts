import { err, ok, type Result } from "~/lib/result";
import type { CurrencyCode, MoneyError } from "./types";

/**
 * How many decimal places a currency has.
 *
 * Read from `Intl`, which carries the CLDR data, rather than a hardcoded 100.
 * "Multiply by 100" is wrong for about twenty currencies:
 *
 *   JPY, KRW, VND, CLP …  0 decimals  →  ¥1000 is 1000 minor units
 *   USD, EUR, GBP …       2 decimals  →  $19.99 is 1999
 *   KWD, BHD, JOD, TND …  3 decimals  →  1.234 KWD is 1234
 *
 * A Shopify app sells in whatever currency the merchant's market uses, so this is
 * not an edge case you can defer.
 */
const decimalsCache = new Map<string, number>();

/**
 * The currencies the runtime actually knows — 159 of them in workerd.
 *
 * NOT `Intl.NumberFormat`: that accepts ANY well-formed three-letter code and
 * simply uses it as the symbol, so `"ZZZ"` passes and a typo'd currency reaches
 * the database looking valid. `Intl.supportedValuesOf` is the real list.
 *
 * Computed once, lazily — it is a sizeable array and most requests never need it.
 */
let knownCurrencies: Set<string> | undefined;

function known(): Set<string> {
  knownCurrencies ??= new Set(Intl.supportedValuesOf("currency"));
  return knownCurrencies;
}

/**
 * Validate a currency code.
 *
 * Shape first, then MEMBERSHIP. A code that is merely well-formed is not a
 * currency, and accepting one means the failure surfaces later as a nonsense
 * symbol on an invoice rather than here as a rejected input.
 */
export function toCurrency(code: string): Result<CurrencyCode, MoneyError> {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(upper)) {
    return err("unknown_currency", `"${code}" is not a three-letter code`);
  }
  if (!known().has(upper)) {
    return err("unknown_currency", `"${upper}" is not a known ISO 4217 currency`);
  }
  return ok(upper as CurrencyCode);
}

/**
 * Decimal places for a validated code. Throws for an unknown one — callers reach
 * it through `toCurrency`, which turns that into a `Result`.
 */
export function currencyDecimals(currency: string): number {
  const cached = decimalsCache.get(currency);
  if (cached !== undefined) return cached;

  // `RangeError` for an unknown code. Deliberately not caught here.
  const resolved = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions();

  const decimals = resolved.maximumFractionDigits ?? 2;
  decimalsCache.set(currency, decimals);
  return decimals;
}

/** 10 ** decimals — how many minor units make one major unit. */
export function minorUnitsPerMajor(currency: CurrencyCode): number {
  return 10 ** currencyDecimals(currency);
}
