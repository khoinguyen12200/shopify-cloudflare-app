import { isNegative, isZero, multiply, subtract, type Money } from "~/money";

const MONTHS_PER_YEAR = 12;

interface PricedPlan {
  readonly priceMonthly: Money;
  readonly priceAnnual: Money;
}

/**
 * How much cheaper paying annually is, as a whole percent — "save 17%".
 *
 * A percentage rather than an amount because it survives translation and
 * currency: the same plan reads "save 17%" in every market, where an amount
 * needs formatting and means nothing without the monthly price beside it.
 *
 * `null` whenever there is nothing honest to claim: a free plan, an annual
 * price that is not cheaper, a currency mismatch between the two prices, a
 * saving that rounds to 0%, or arithmetic that cannot be represented exactly.
 * The UI renders the discount only when this returns a number, so it can never
 * print "save 0%" or a figure derived from two different currencies.
 *
 * The money arithmetic stays inside `~/money` (@rules/money.md); only the
 * final ratio — a dimensionless number, not an amount — is a division.
 */
export function annualSavingPercent(plan: PricedPlan): number | null {
  const twelveMonths = multiply(plan.priceMonthly, MONTHS_PER_YEAR);
  if (!twelveMonths.ok || isZero(twelveMonths.value)) return null;

  // subtract() is what refuses a currency mismatch, rather than a shape check.
  const saved = subtract(twelveMonths.value, plan.priceAnnual);
  if (!saved.ok || isZero(saved.value) || isNegative(saved.value)) return null;

  const percent = Math.round((saved.value.amount / twelveMonths.value.amount) * 100);
  return percent > 0 ? percent : null;
}
