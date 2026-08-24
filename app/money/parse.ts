import { err, ok, type Result } from "~/lib/result";
import { currencyDecimals, toCurrency } from "./currency";
import type {
  CurrencyCode,
  MinorUnits,
  Money,
  MoneyError,
  ShopifyMoneyV2,
} from "./types";

/**
 * THE ONLY WAY MONEY ENTERS THE APP.
 *
 * Parsing is done on the DIGIT STRING, never via `parseFloat` or `Number()` on
 * the decimal. That is the whole point: `Number("0.615")` is already
 * `0.6149999…` before any arithmetic happens, so rounding it afterwards cannot
 * recover the value. Here the string is split, the fraction is padded or checked,
 * and only a whole-number string is converted.
 */

/**
 * Build minor units from a value you have already proven correct — a literal in a
 * test, a constant, a value read back out of an integer column.
 *
 * Rejects a non-integer, so `fromMinorUnits(19.99)` cannot slip through.
 */
export function fromMinorUnits(
  amount: number,
  currency: CurrencyCode,
): Result<Money, MoneyError> {
  if (!Number.isInteger(amount)) {
    return err(
      "malformed_amount",
      `${amount} is not a whole number of minor units — did you pass a major-unit float?`,
    );
  }
  if (!Number.isSafeInteger(amount)) {
    return err("out_of_range", `${amount} exceeds the exact integer range`);
  }
  return ok({ amount: amount as MinorUnits, currency });
}

/**
 * Parse a decimal STRING into minor units.
 *
 * Handles what Shopify actually sends: `"29.99"`, `"100"`, `"29.999"`, a leading
 * `+`/`-` (refunds are negative), and a bare `".5"`.
 *
 * `allowRounding` is off by default, so extra precision is REFUSED rather than
 * silently dropped. Shopify's `Decimal` is arbitrary precision — its own docs use
 * `"29.999"` — and quietly truncating that to `29.99` loses a tenth of a cent per
 * line, which reconciles to a real discrepancy at volume. Turn it on only where
 * you have decided rounding is correct, and it rounds half-away-from-zero rather
 * than JavaScript's half-up, so a refund of `-0.005` and a charge of `0.005`
 * round to the same magnitude.
 */
export function fromDecimalString(
  decimal: string,
  currencyInput: string,
  options: { allowRounding?: boolean } = {},
): Result<Money, MoneyError> {
  const currencyResult = toCurrency(currencyInput);
  if (!currencyResult.ok) return currencyResult;
  const currency = currencyResult.value;

  const raw = decimal.trim();
  // Anchored, and no exponent form: `"1e3"` is not something Shopify sends, and
  // accepting it would mean interpreting a float notation after going to this
  // much trouble to avoid floats.
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match || (match[2] === "" && (match[3] ?? "") === "")) {
    return err("malformed_amount", `"${decimal}" is not a decimal number`);
  }

  const [, sign, wholeRaw, fractionRaw = ""] = match;
  const whole = wholeRaw === "" ? "0" : wholeRaw!;
  const decimals = currencyDecimals(currency);

  let fraction = fractionRaw;
  let carry = 0;

  if (fraction.length > decimals) {
    const keep = fraction.slice(0, decimals);
    const rest = fraction.slice(decimals);

    // Trailing zeros are not precision: "29.9900" in a 2-decimal currency is
    // exactly 29.99, so it must not be refused.
    if (/[^0]/.test(rest)) {
      if (!options.allowRounding) {
        return err(
          "precision_loss",
          `"${decimal}" has ${fraction.length} decimal places but ${currency} has ${decimals} — pass allowRounding to accept the loss deliberately`,
        );
      }
      // Half away from zero, decided on the DIGITS: the first dropped digit ≥ 5
      // rounds the magnitude up. Sign is applied afterwards, so -0.005 and 0.005
      // round symmetrically.
      if (Number(rest[0]) >= 5) carry = 1;
    }
    fraction = keep;
  }

  const digits = `${whole}${fraction.padEnd(decimals, "0")}`;
  // Only ever a whole-number string reaches Number(), so no float is involved.
  const magnitude = Number(digits) + carry;

  if (!Number.isSafeInteger(magnitude)) {
    return err(
      "out_of_range",
      `"${decimal}" ${currency} exceeds the exact integer range`,
    );
  }

  const amount = sign === "-" ? -magnitude : magnitude;
  return ok({ amount: amount as MinorUnits, currency });
}

/**
 * Parse Shopify's `MoneyV2` — the automatic transform from their API into ours.
 *
 * Use this at EVERY boundary where money arrives. A GraphQL response reaching a
 * model or a template with `amount` still a string is how a `parseFloat` gets
 * added later by someone who needed a number.
 */
export function fromMoneyV2(
  money: ShopifyMoneyV2,
  options?: { allowRounding?: boolean },
): Result<Money, MoneyError> {
  return fromDecimalString(money.amount, money.currencyCode, options);
}

/**
 * Parse a `MoneyV2` that may be absent.
 *
 * Shopify nulls money fields routinely (no discount, no shipping), and `null` is
 * not an error — it is zero, or nothing. Returning `null` keeps the caller from
 * inventing a currency for an amount that does not exist.
 */
export function fromNullableMoneyV2(
  money: ShopifyMoneyV2 | null | undefined,
  options?: { allowRounding?: boolean },
): Result<Money | null, MoneyError> {
  if (!money) return ok(null);
  return fromMoneyV2(money, options);
}

/**
 * Back to a decimal string, for sending money BACK to Shopify.
 *
 * Built from the digits, so the round trip is exact. `(1999 / 100).toFixed(2)`
 * happens to work at small values and stops being reliable as they grow.
 */
export function toDecimalString(money: Money): string {
  const decimals = currencyDecimals(money.currency);
  const negative = money.amount < 0;
  const digits = String(Math.abs(money.amount)).padStart(decimals + 1, "0");

  const whole = digits.slice(0, digits.length - decimals);
  const fraction = decimals === 0 ? "" : `.${digits.slice(digits.length - decimals)}`;
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

/** The `MoneyV2` shape, for a GraphQL variable. */
export function toMoneyV2(money: Money): ShopifyMoneyV2 {
  return { amount: toDecimalString(money), currencyCode: money.currency };
}

/** Zero in a currency — the identity for `add`, and a safe default. */
export function zero(currency: CurrencyCode): Money {
  return { amount: 0 as MinorUnits, currency };
}
