import { err, ok, type Result } from "~/lib/result";
import type { MinorUnits, Money, MoneyError } from "./types";

/**
 * Arithmetic on minor units — integers throughout, so nothing can drift.
 *
 * Every binary operation REFUSES mismatched currencies. Adding 500 JPY to 500 USD
 * is not a rounding problem to be tolerated, it is a bug, and the only place it
 * can be caught is here.
 */

function sameCurrency(a: Money, b: Money): boolean {
  return a.currency === b.currency;
}

const mismatch = (a: Money, b: Money) =>
  err<MoneyError>(
    "currency_mismatch",
    `${a.currency} and ${b.currency} cannot be combined`,
  );

export function add(a: Money, b: Money): Result<Money, MoneyError> {
  if (!sameCurrency(a, b)) return mismatch(a, b);
  const sum = a.amount + b.amount;
  if (!Number.isSafeInteger(sum)) return err("out_of_range", "sum is not exact");
  return ok({ amount: sum as MinorUnits, currency: a.currency });
}

export function subtract(a: Money, b: Money): Result<Money, MoneyError> {
  if (!sameCurrency(a, b)) return mismatch(a, b);
  const difference = a.amount - b.amount;
  if (!Number.isSafeInteger(difference)) {
    return err("out_of_range", "difference is not exact");
  }
  return ok({ amount: difference as MinorUnits, currency: a.currency });
}

/** Sum a list. An empty list needs a currency, so it takes one. */
export function sum(
  items: readonly Money[],
  currency: Money["currency"],
): Result<Money, MoneyError> {
  let total: Money = { amount: 0 as MinorUnits, currency };
  for (const item of items) {
    const next = add(total, item);
    if (!next.ok) return next;
    total = next.value;
  }
  return ok(total);
}

/**
 * Multiply by a whole quantity — a line total from a unit price.
 *
 * Integer only. A fractional multiplier is `applyRate`, which has to decide how
 * to round and says so.
 */
export function multiply(
  money: Money,
  quantity: number,
): Result<Money, MoneyError> {
  if (!Number.isInteger(quantity)) {
    return err(
      "malformed_amount",
      `quantity ${quantity} is not a whole number — use applyRate for a fractional multiplier`,
    );
  }
  const product = money.amount * quantity;
  if (!Number.isSafeInteger(product)) {
    return err("out_of_range", "product is not exact");
  }
  return ok({ amount: product as MinorUnits, currency: money.currency });
}

export type Rounding = "half_up" | "half_away_from_zero" | "down" | "up";

/**
 * Apply a rate — a tax percentage, a discount fraction.
 *
 * The rounding mode is REQUIRED, with no default. There is no universally correct
 * choice: tax authorities differ, and picking one silently means the difference
 * shows up as a penny of unexplained variance in someone's books. Making the
 * caller state it forces the decision to be made once, visibly.
 *
 * `half_away_from_zero` is usually what you want for money, because it treats a
 * refund and a charge of the same magnitude symmetrically — `half_up` rounds
 * -0.5 to 0 and +0.5 to 1.
 */
export function applyRate(
  money: Money,
  rate: number,
  rounding: Rounding,
): Result<Money, MoneyError> {
  if (!Number.isFinite(rate)) {
    return err("malformed_amount", `rate ${rate} is not a finite number`);
  }

  // The rate is the one genuinely fractional input, so the multiplication happens
  // in floating point and is rounded IMMEDIATELY back to an integer. Nothing
  // fractional is ever stored or carried forward, which is what keeps the error
  // from accumulating.
  const exact = money.amount * rate;
  const rounded = roundToInteger(exact, rounding);

  if (!Number.isSafeInteger(rounded)) {
    return err("out_of_range", "result is not exact");
  }
  return ok({ amount: rounded as MinorUnits, currency: money.currency });
}

function roundToInteger(value: number, rounding: Rounding): number {
  switch (rounding) {
    case "half_up":
      return Math.round(value);
    case "half_away_from_zero":
      return value < 0 ? -Math.round(-value) : Math.round(value);
    case "down":
      return Math.trunc(value);
    case "up":
      return value < 0 ? Math.floor(value) : Math.ceil(value);
  }
}

export function negate(money: Money): Money {
  return { amount: -money.amount as MinorUnits, currency: money.currency };
}

export function isZero(money: Money): boolean {
  return money.amount === 0;
}

export function isNegative(money: Money): boolean {
  return money.amount < 0;
}

/** -1, 0 or 1. Refuses to compare different currencies. */
export function compare(a: Money, b: Money): Result<number, MoneyError> {
  if (!sameCurrency(a, b)) return mismatch(a, b);
  return ok(Math.sign(a.amount - b.amount));
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amount === b.amount;
}

/**
 * Split an amount across weights WITHOUT losing or inventing a unit.
 *
 * This is the operation everyone gets wrong. Splitting $10.00 three ways by
 * dividing and rounding gives 3.33 + 3.33 + 3.33 = $9.99, and the missing cent
 * turns up later as an unbalanced order. Allocating a discount across lines has
 * exactly the same shape.
 *
 * Largest-remainder: floor every share, then hand the leftover units out one at a
 * time to the largest remainders. The result ALWAYS sums to the input — asserted
 * by a property test over random inputs.
 */
export function allocate(
  money: Money,
  weights: readonly number[],
): Result<Money[], MoneyError> {
  if (weights.length === 0) {
    return err("malformed_amount", "allocate needs at least one weight");
  }
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) {
    return err("malformed_amount", "weights must be finite and non-negative");
  }

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) {
    return err("malformed_amount", "weights sum to zero, so there is nothing to divide by");
  }

  // Work in magnitude so a negative total (a refund) splits the same way, then
  // reapply the sign — otherwise flooring a negative share rounds the wrong way.
  const negative = money.amount < 0;
  const magnitude = Math.abs(money.amount);

  const exact = weights.map((w) => (magnitude * w) / totalWeight);
  const shares = exact.map(Math.floor);
  let remaining = magnitude - shares.reduce((a, b) => a + b, 0);

  // Largest fractional remainder first; ties go to the earlier index so the
  // result is deterministic rather than dependent on sort stability.
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of order) {
    if (remaining <= 0) break;
    shares[index] = (shares[index] ?? 0) + 1;
    remaining -= 1;
  }

  return ok(
    shares.map((share) => ({
      amount: (negative ? -share : share) as MinorUnits,
      currency: money.currency,
    })),
  );
}
