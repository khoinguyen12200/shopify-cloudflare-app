import { unwrap } from "~/lib/result";
import { fromMinorUnits, toCurrency, type Money } from "~/money";

export type PlanHandle = "free" | "pro";

export type BillingInterval = "monthly" | "annual";

/** Every `common:plans.<key>.features.*` key that exists — see the locale files. */
export type PlanFeatureKey =
  | "free.features.0"
  | "free.features.1"
  | "pro.features.0"
  | "pro.features.1"
  | "pro.features.2";

export interface Plan {
  /** The Shopify Managed Pricing handle; this is the plan identity. */
  readonly handle: PlanHandle;
  /**
   * TODO — replace before launch. Shown to merchants everywhere this plan is
   * displayed (landing, pricing, the billing page), and it's also the name
   * you'll give this plan when you configure it in the Partner/Dev Dashboard
   * under Managed Pricing. The `TODO:` prefix is deliberate: it's the one
   * string that has to change, so it stays impossible to miss.
   */
  readonly name: string;
  /** TODO — set real prices once you know them. Zero for the free plan. */
  readonly priceMonthly: Money;
  /**
   * TODO — the annual price, normally cheaper than 12x monthly (a common
   * SaaS convention: roughly 2 months free). Zero for the free plan.
   */
  readonly priceAnnual: Money;
  /** i18n keys under `common:plans.<key>.features.*` — TODO: what it includes. */
  readonly featureKeys: readonly PlanFeatureKey[];
}

const USD = unwrap(toCurrency("USD"));

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE PLACE plans are defined. Everywhere else — the billing page, the
// public pricing page, the landing page's pricing teaser — reads this
// catalogue rather than naming a plan or a price of its own.
// ─────────────────────────────────────────────────────────────────────────────
export const PLANS: Readonly<Record<PlanHandle, Plan>> = {
  free: {
    handle: "free",
    name: "TODO:FREE",
    priceMonthly: unwrap(fromMinorUnits(0, USD)),
    priceAnnual: unwrap(fromMinorUnits(0, USD)),
    featureKeys: ["free.features.0", "free.features.1"],
  },
  pro: {
    handle: "pro",
    name: "TODO:PRO",
    priceMonthly: unwrap(fromMinorUnits(1900, USD)),
    // ~2 months free versus paying monthly — TODO: your real annual price.
    priceAnnual: unwrap(fromMinorUnits(19000, USD)),
    featureKeys: ["pro.features.0", "pro.features.1", "pro.features.2"],
  },
};

/** For iterating in display order — cheapest first. */
export const PLAN_LIST: readonly Plan[] = [PLANS.free, PLANS.pro];

/**
 * The cheapest plan anyone actually pays for — the one a pricing page is
 * trying to sell. Derived from the ladder rather than a hand-set "popular"
 * flag, so inserting a cheaper paid tier moves the highlight by itself and
 * there is no second place to remember to update.
 *
 * Falls back to the first plan when nothing is paid: there is no upsell, but
 * callers still need a handle rather than `undefined`.
 */
export function cheapestPaidPlanHandle<T extends { handle: string; priceMonthly: { amount: number } }>(
  plans: readonly T[],
): T["handle"] {
  const paid = plans.filter((plan) => plan.priceMonthly.amount > 0);
  const ladder = paid.length > 0 ? paid : plans;
  return ladder.reduce((cheapest, plan) =>
    plan.priceMonthly.amount < cheapest.priceMonthly.amount ? plan : cheapest,
  ).handle;
}

/**
 * Which plan the pricing surfaces feature. The billing page, the public
 * pricing page and the landing page's teaser all read this rather than naming
 * a plan key themselves.
 */
export const FEATURED_PLAN_HANDLE: PlanHandle = cheapestPaidPlanHandle(PLAN_LIST);

/** The one place that knows which column an interval reads from. */
export function priceFor(plan: Plan, interval: BillingInterval): Money {
  return interval === "annual" ? plan.priceAnnual : plan.priceMonthly;
}

/**
 * Map Shopify's `plan_handle` back to one of our plans.
 *
 * `null` for anything we don't recognise — including every handle until the
 * TODO above is resolved — rather than guessing a plan for a charge we can't
 * actually identify.
 */
export function planForShopifyHandle(handle: string | null | undefined): Plan | null {
  if (!handle) return null;
  return PLAN_LIST.find((plan) => plan.handle === handle) ?? null;
}
