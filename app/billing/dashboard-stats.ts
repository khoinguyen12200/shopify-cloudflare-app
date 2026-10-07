import { applyRate, fromMinorUnits, sum, toCurrency, type Money } from "~/money";
import type { Shop } from "~/db/schema";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";
import { isOperationalRelationshipStatus } from "~/domain/shop-lifecycle";
import { PLAN_LIST, type Plan } from "~/billing/plans";

export interface BillingProjection {
  readonly shop: string;
  readonly relationshipStatus: Shop["relationshipStatus"];
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly billingInterval: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  readonly planHandle?: string | null;
  readonly isDevStore?: boolean;
}

export interface BillingStats {
  readonly totalShops: number;
  readonly paidShops: number;
  readonly freeShops: number;
  readonly devShops: number;
  /**
   * Monthly-recurring-revenue equivalent, one figure per currency — summing
   * across currencies would misstate the total (@rules/money.md), and a real
   * install base can genuinely have merchants billed in more than one.
   */
  readonly mrrByCurrency: readonly Money[];
  /** Number of active merchant stores on each configured plan. */
  readonly shopsByPlan: Readonly<Record<string, number>>;
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
export function computeBillingStats(
  projections: readonly BillingProjection[],
  knownPlans: readonly Plan[] = PLAN_LIST,
): BillingStats {
  const monthlyByCurrency = new Map<string, Money[]>();
  const paidShops = new Set<string>();
  const realShops = new Set<string>();
  const devShops = new Set<string>();
  const shopPlan = new Map<string, string>();

  const shopsByPlan: Record<string, number> = {};
  for (const plan of knownPlans) {
    shopsByPlan[plan.handle] = 0;
  }

  for (const projection of projections) {
    if (projection.isDevStore) {
      devShops.add(projection.shop);
      continue;
    }
    realShops.add(projection.shop);

    if (!isOperationalRelationshipStatus(projection.relationshipStatus)) continue;
    if (!projection.subscriptionStatus || !PAID_STATUSES.has(projection.subscriptionStatus)) continue;
    paidShops.add(projection.shop);

    if (projection.planHandle) {
      const match = knownPlans.find((p) => p.handle === projection.planHandle);
      shopPlan.set(projection.shop, match ? match.handle : projection.planHandle);
    } else if (!shopPlan.has(projection.shop)) {
      const defaultPaid = knownPlans.find((p) => p.priceMonthly.amount > 0)?.handle ?? "paid";
      shopPlan.set(projection.shop, defaultPaid);
    }

    const monthly = monthlyEquivalent(projection);
    if (!monthly) continue; // Malformed arithmetic degrades this one figure, not the page.
    const bucket = monthlyByCurrency.get(monthly.currency) ?? [];
    bucket.push(monthly);
    monthlyByCurrency.set(monthly.currency, bucket);
  }

  const freeHandle = knownPlans.find((p) => p.priceMonthly.amount === 0)?.handle ?? "free";
  for (const shop of realShops) {
    if (paidShops.has(shop)) {
      const plan = shopPlan.get(shop) ?? (knownPlans.find((p) => p.priceMonthly.amount > 0)?.handle ?? "paid");
      shopsByPlan[plan] = (shopsByPlan[plan] ?? 0) + 1;
    } else {
      shopsByPlan[freeHandle] = (shopsByPlan[freeHandle] ?? 0) + 1;
    }
  }

  const mrrByCurrency: Money[] = [];
  for (const [currency, amounts] of monthlyByCurrency) {
    const currencyCode = toCurrency(currency);
    if (!currencyCode.ok) continue;
    const total = sum(amounts, currencyCode.value);
    if (total.ok) mrrByCurrency.push(total.value);
  }

  return {
    totalShops: realShops.size,
    paidShops: paidShops.size,
    freeShops: realShops.size - paidShops.size,
    devShops: devShops.size,
    mrrByCurrency,
    shopsByPlan,
  };
}
