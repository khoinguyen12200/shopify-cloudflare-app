// ─────────────────────────────────────────────────────────────────────────────
// MONEY. Integer minor units and a currency, always together, never a float.
//
// WHY THIS MODULE EXISTS, demonstrated in this project's own D1:
//
//   0.1 + 0.2          →  0.30000000000000004
//   0.1 + 0.2 = 0.3    →  0  (false)
//   ROUND(0.615, 2)    →  0.61   ← not 0.62; 0.615 is really 0.6149999… in binary
//
// D1 is SQLite, so `REAL` exists and it is IEEE-754 double — and SQLite has NO
// fixed-point decimal type at all (its `NUMERIC` is a type AFFINITY, not
// `DECIMAL(10,2)`). There is therefore nothing to store money in safely except
// `INTEGER`.
//
// Shopify agrees: in the Admin schema, `Decimal` is "a signed decimal number,
// which supports arbitrary precision and is SERIALIZED AS A STRING" and `Money`
// is "a monetary value string". They hand you `"29.99"` deliberately, to avoid
// losing precision in transit. `parseFloat` on that is you discarding the
// protection they built.
// ─────────────────────────────────────────────────────────────────────────────

declare const minorUnitsBrand: unique symbol;
declare const currencyBrand: unique symbol;

/**
 * A whole number of a currency's smallest unit — 1999 for $19.99, 1000 for
 * ¥1000, 1234 for 1.234 KWD.
 *
 * BRANDED so a bare `number` cannot be passed where minor units are expected.
 * Without the brand, `formatMoney(locale, 19.99, "USD")` typechecks and quietly
 * renders `$0.20` — a real bug that reads as a rounding problem rather than a
 * unit problem. The only way to obtain one is through this module.
 */
export type MinorUnits = number & { readonly [minorUnitsBrand]: "MinorUnits" };

/** A validated ISO 4217 code. Branded for the same reason. */
export type CurrencyCode = string & { readonly [currencyBrand]: "CurrencyCode" };

/**
 * An amount and its currency, INSEPARABLE.
 *
 * Two columns or two arguments drift: one gets copied, converted, or defaulted
 * and the other does not. Adding 500 to 500 is meaningless unless both are the
 * same currency, and this shape is what lets the arithmetic refuse when they are
 * not.
 */
export interface Money {
  readonly amount: MinorUnits;
  readonly currency: CurrencyCode;
}

/** Everything that can go wrong turning external input into `Money`. */
export type MoneyError =
  /** Not a decimal number at all. */
  | "malformed_amount"
  /** Not a currency code the runtime recognises. */
  | "unknown_currency"
  /**
   * More decimal places than the currency has minor units, so converting would
   * silently lose value. Shopify's `Decimal` is arbitrary precision and its own
   * docs use `"29.999"` as an example, so this is a real case, not a theoretical
   * one.
   */
  | "precision_loss"
  /** Beyond the range JavaScript integers represent exactly. */
  | "out_of_range"
  /** Arithmetic between two different currencies. */
  | "currency_mismatch";

/**
 * The shape Shopify's Admin API returns for money.
 *
 * `amount` is a STRING on purpose — see the module comment. Typed here as
 * `string` rather than `number` so a caller cannot hand this module something
 * that has already been through `parseFloat`.
 */
export interface ShopifyMoneyV2 {
  amount: string;
  currencyCode: string;
}
