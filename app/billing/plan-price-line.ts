import { PLANS } from "./plans";
import type { BillingStatus } from "./subscription-status";
import type { Money } from "~/money";

/**
 * What the merchant is charged, as one line — or nothing, when we do not know.
 *
 * Two failure modes this exists to prevent, both of which state a charge that
 * is not happening:
 *
 *   • Calling an ANNUAL subscription "/mo". The figure Shopify reports for a
 *     yearly plan is the yearly amount; labelling it monthly misstates what
 *     leaves the merchant's account by a factor of twelve.
 *   • Falling back to the catalogue price when the subscription carries none.
 *     A merchant may be on a grandfathered or discounted charge, so the
 *     catalogue figure is a guess — and a guess about money is a defect.
 *
 * Hence `cadence: "none"` (a real amount, no interval reported — show the
 * figure bare) and `null` (no amount — show no figure at all). The catalogue
 * is read for exactly one case: the free plan, where zero is definitional and
 * nothing is being inferred.
 *
 * Pure, so every branch is provable without a Shopify call (@rules/money.md).
 */
export type PriceCadence = "monthly" | "yearly" | "none";

export interface PlanPriceLine {
  readonly price: Money;
  readonly cadence: PriceCadence;
}

export function planPriceLine(status: BillingStatus): PlanPriceLine | null {
  if (status.kind === "free") {
    return { price: PLANS.free.priceMonthly, cadence: "monthly" };
  }

  if (!status.price) return null;

  if (status.interval === "annual") return { price: status.price, cadence: "yearly" };
  if (status.interval === "every_30_days") {
    return { price: status.price, cadence: "monthly" };
  }

  return { price: status.price, cadence: "none" };
}
