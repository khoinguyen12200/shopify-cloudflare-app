import { currencyDecimals, fromDecimalString, toCurrency, type Money } from "~/money";
export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "PENDING" | "DECLINED" | "EXPIRED" | "FROZEN" | "ACCEPTED";

/** The parts of `billing.check()`'s `AppSubscription` this module actually reads. */
export interface AppSubscriptionLike {
  readonly name: string;
  readonly status: SubscriptionStatus;
  readonly test: boolean;
  readonly trialDays: number;
  /** ISO timestamp. */
  readonly createdAt: string;
  /** ISO timestamp. */
  readonly currentPeriodEnd: string;
  readonly lineItems: readonly {
    readonly plan: {
      readonly pricingDetails:
        | { readonly interval: string; readonly price: { readonly amount: number; readonly currencyCode: string } }
        | { readonly balanceUsed: unknown };
    };
  }[];
}

export type BillingStatus =
  | { readonly kind: "free" }
  | {
      readonly kind: "subscribed";
      readonly name: string;
      readonly status: SubscriptionStatus;
      readonly test: boolean;
      readonly price: Money | null;
      readonly interval: "every_30_days" | "annual" | null;
      /** Epoch ms — set only while a trial is still running. */
      readonly trialEndsAt: number | null;
      /** Epoch ms — Shopify's `currentPeriodEnd`, regardless of trial state. */
      readonly periodEnd: number;
    };

const INTERVAL_LABEL: Record<string, "every_30_days" | "annual"> = {
  EVERY_30_DAYS: "every_30_days",
  ANNUAL: "annual",
};

/**
 * `billing.check()`'s pricing already arrives as a parsed `{amount: number}`,
 * not the raw decimal string `~/money` normally parses — the SDK did that
 * conversion, not us. Rebuilding a clean `Money` from a float means going
 * through a fixed-precision string rather than multiplying by the currency's
 * scale directly: `19.99 * 100` is `1998.9999999999998` in IEEE-754, and that
 * is exactly the class of bug `~/money` exists to prevent.
 */
function moneyFromApiAmount(amount: number, currencyCode: string): Money | null {
  const currency = toCurrency(currencyCode);
  if (!currency.ok) return null;
  const parsed = fromDecimalString(amount.toFixed(currencyDecimals(currency.value)), currency.value);
  return parsed.ok ? parsed.value : null;
}

type Subscribed = Extract<BillingStatus, { kind: "subscribed" }>;

function pricingOf(sub: AppSubscriptionLike): { price: Money | null; interval: Subscribed["interval"] } {
  const details = sub.lineItems[0]?.plan.pricingDetails;
  if (!details || !("interval" in details)) return { price: null, interval: null };
  return {
    price: moneyFromApiAmount(details.price.amount, details.price.currencyCode),
    interval: INTERVAL_LABEL[details.interval] ?? null,
  };
}

/** `null` once the trial (if any) has already ended by `now`. */
function trialEndsAt(sub: AppSubscriptionLike, now: number): number | null {
  if (sub.trialDays <= 0) return null;
  const createdAt = Date.parse(sub.createdAt);
  if (Number.isNaN(createdAt)) return null;
  const endsAt = createdAt + sub.trialDays * 86_400_000;
  return endsAt > now ? endsAt : null;
}

/**
 * Turn `billing.check()`'s raw result into the one thing the billing page
 * renders. `now` is a parameter, never `Date.now()` — see @rules/code-craft.md.
 */
export function resolveBillingStatus(
  check: { hasActivePayment: boolean; appSubscriptions: readonly AppSubscriptionLike[] },
  now: number,
): BillingStatus {
  const sub = check.appSubscriptions[0];
  if (!check.hasActivePayment || !sub) return { kind: "free" };

  const { price, interval } = pricingOf(sub);

  return {
    kind: "subscribed",
    name: sub.name,
    status: sub.status,
    test: sub.test,
    price,
    interval,
    trialEndsAt: trialEndsAt(sub, now),
    periodEnd: Date.parse(sub.currentPeriodEnd),
  };
}
