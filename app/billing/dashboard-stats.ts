import { applyRate, fromMinorUnits, sum, toCurrency, type Money } from "~/money";
import type { Shop } from "~/db/schema";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";
import { isOperationalRelationship } from "~/domain/shop-lifecycle";

export interface BillingProjection {
  readonly shop: string;
  readonly relationshipStatus: Shop["relationshipStatus"];
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly billingInterval: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
}

export interface BillingStats {
  readonly totalShops: number;
  readonly paidShops: number;
  readonly freeShops: number;
  /**
   * Monthly-recurring-revenue equivalent, one figure per currency — summing
   * across currencies would misstate the total (@rules/money.md), and a real
   * install base can genuinely have merchants billed in more than one.
   */
  readonly mrrByCurrency: readonly Money[];
}

const PAID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["ACTIVE", "CANCELLATION_SCHEDULED"]);

/** An annual charge's monthly equivalent, for a like-for-like MRR figure. */
function monthlyEquivalent(projection: BillingProjection): Money | null {
  if (projection.priceAmount === null || projection.priceCurrency === null) return null;
  const currency = toCurrency(projection.priceCurrency);
  if (!currency.ok) return null;
  const priceResult = fromMinorUnits(projection.priceAmount, currency.value);
  if (!priceResult.ok) return null;
  const price = priceResult.value;
  const interval = projection.billingInterval?.toUpperCase();
  if (interval !== "ANNUAL" && interval !== "YEAR") return price;
  const monthly = applyRate(price, 1 / 12, "half_away_from_zero");
  return monthly.ok ? monthly.value : null;
}

/**
 * Dashboard numbers derived from relationship and current subscription projections.
 */
export function computeBillingStats(projections: readonly BillingProjection[]): BillingStats {
  const monthlyByCurrency = new Map<string, Money[]>();
  const paidShops = new Set<string>();
  const shops = new Set(projections.map((projection) => projection.shop));

  for (const projection of projections) {
    if (!isOperationalRelationship(projection.relationshipStatus ? {
      kind: projection.relationshipStatus === "INSTALLED" || projection.relationshipStatus === "REACTIVATED"
        ? projection.relationshipStatus === "INSTALLED" ? "installed" : "reactivated"
        : projection.relationshipStatus === "UNINSTALLED" ? "uninstalled" : "deactivated",
      occurredAt: 0,
      externalId: "",
    } : null)) continue;
    if (!projection.subscriptionStatus || !PAID_STATUSES.has(projection.subscriptionStatus)) continue;
    paidShops.add(projection.shop);

    const monthly = monthlyEquivalent(projection);
    if (!monthly) continue; // Malformed arithmetic degrades this one figure, not the page.
    const bucket = monthlyByCurrency.get(monthly.currency) ?? [];
    bucket.push(monthly);
    monthlyByCurrency.set(monthly.currency, bucket);
  }

  const mrrByCurrency: Money[] = [];
  for (const [currency, amounts] of monthlyByCurrency) {
    const currencyCode = toCurrency(currency);
    if (!currencyCode.ok) continue;
    const total = sum(amounts, currencyCode.value);
    if (total.ok) mrrByCurrency.push(total.value);
  }

  return {
    totalShops: shops.size,
    paidShops: paidShops.size,
    freeShops: shops.size - paidShops.size,
    mrrByCurrency,
  };
}
