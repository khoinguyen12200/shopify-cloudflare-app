import { applyRate, fromMinorUnits, multiply, sum, toCurrency, type Money } from "~/money";
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
function monthlyEquivalent(projection: {
  readonly billingInterval: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
}): Money | null {
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
 * Shops that share every field that matters to the stats, with how many there
 * are. This is the shape a SQL `GROUP BY` returns, so the dashboard never loads
 * a row per shop.
 */
export interface ShopBillingGroup {
  readonly relationshipStatus: Shop["relationshipStatus"];
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly planHandle: string | null;
  readonly isDevStore: boolean;
  /** How many shops fall in this group. */
  readonly shops: number;
}

/** Current pricing items that share a price, with how many there are. */
export interface RevenueBillingGroup {
  readonly relationshipStatus: Shop["relationshipStatus"];
  readonly subscriptionStatus: SubscriptionStatus | null;
  readonly billingInterval: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  /** How many pricing items fall in this group. */
  readonly items: number;
}

/**
 * Dashboard numbers from grouped counts: one group per distinct shop shape, and
 * one per distinct price. Dev stores are counted but never reach revenue, so
 * `revenueGroups` should already exclude them.
 */
export function computeBillingStatsFromGroups(
  shopGroups: readonly ShopBillingGroup[],
  revenueGroups: readonly RevenueBillingGroup[],
  knownPlans: readonly Plan[] = PLAN_LIST,
): BillingStats {
  const defaultPaid = knownPlans.find((p) => p.priceMonthly.amount > 0)?.handle ?? "paid";
  const freeHandle = knownPlans.find((p) => p.priceMonthly.amount === 0)?.handle ?? "free";

  const shopsByPlan: Record<string, number> = {};
  for (const plan of knownPlans) {
    shopsByPlan[plan.handle] = 0;
  }

  let realShops = 0;
  let paidShops = 0;
  let devShops = 0;

  for (const group of shopGroups) {
    if (group.isDevStore) {
      devShops += group.shops;
      continue;
    }
    realShops += group.shops;

    const isPaid =
      isOperationalRelationshipStatus(group.relationshipStatus) &&
      group.subscriptionStatus !== null &&
      PAID_STATUSES.has(group.subscriptionStatus);
    const plan = isPaid ? (group.planHandle ?? defaultPaid) : freeHandle;
    if (isPaid) paidShops += group.shops;
    shopsByPlan[plan] = (shopsByPlan[plan] ?? 0) + group.shops;
  }

  const monthlyByCurrency = new Map<string, Money[]>();
  for (const group of revenueGroups) {
    if (!isOperationalRelationshipStatus(group.relationshipStatus)) continue;
    if (!group.subscriptionStatus || !PAID_STATUSES.has(group.subscriptionStatus)) continue;

    const monthly = monthlyEquivalent(group);
    if (!monthly) continue; // Malformed arithmetic degrades this one figure, not the page.
    const line = multiply(monthly, group.items);
    if (!line.ok) continue;
    const bucket = monthlyByCurrency.get(line.value.currency) ?? [];
    bucket.push(line.value);
    monthlyByCurrency.set(line.value.currency, bucket);
  }

  const mrrByCurrency: Money[] = [];
  for (const [currency, amounts] of monthlyByCurrency) {
    const currencyCode = toCurrency(currency);
    if (!currencyCode.ok) continue;
    const total = sum(amounts, currencyCode.value);
    if (total.ok) mrrByCurrency.push(total.value);
  }

  return {
    totalShops: realShops,
    paidShops,
    freeShops: realShops - paidShops,
    devShops,
    mrrByCurrency,
    shopsByPlan,
  };
}

/**
 * The same numbers from one projection per shop-and-pricing-item. Kept for
 * callers (and tests) that hold per-shop rows; it only reshapes them into
 * groups, so there is exactly one derivation.
 */
export function computeBillingStats(
  projections: readonly BillingProjection[],
  knownPlans: readonly Plan[] = PLAN_LIST,
): BillingStats {
  const firstByShop = new Map<string, BillingProjection>();
  for (const projection of projections) {
    if (!firstByShop.has(projection.shop)) firstByShop.set(projection.shop, projection);
  }
  const shopGroups: ShopBillingGroup[] = [...firstByShop.values()].map((projection) => ({
    relationshipStatus: projection.relationshipStatus,
    subscriptionStatus: projection.subscriptionStatus,
    planHandle: projection.planHandle ?? null,
    isDevStore: projection.isDevStore ?? false,
    shops: 1,
  }));
  const revenueGroups: RevenueBillingGroup[] = projections
    .filter((projection) => !projection.isDevStore)
    .map((projection) => ({
      relationshipStatus: projection.relationshipStatus,
      subscriptionStatus: projection.subscriptionStatus,
      billingInterval: projection.billingInterval,
      priceAmount: projection.priceAmount,
      priceCurrency: projection.priceCurrency,
      items: 1,
    }));
  return computeBillingStatsFromGroups(shopGroups, revenueGroups, knownPlans);
}
