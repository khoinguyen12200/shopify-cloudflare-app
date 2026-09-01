import { applyRate, sum, toCurrency, type Money } from "~/money";
import { storedEventPrice } from "./subscription-event";
import type { Shop, SubscriptionEvent, SubscriptionStatus } from "~/db/schema";

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

const PAID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["ACTIVE", "ACCEPTED"]);

/** An annual charge's monthly equivalent, for a like-for-like MRR figure. */
function monthlyEquivalent(event: SubscriptionEvent): Money | null {
  const price = storedEventPrice(event);
  if (event.interval !== "annual") return price;
  const monthly = applyRate(price, 1 / 12, "half_away_from_zero");
  return monthly.ok ? monthly.value : null;
}

/**
 * The dashboard's own numbers, derived from the shops table and each shop's
 * latest subscription event — never a live Shopify call (@rules/data.md:
 * this is decoration, and decoration degrades, but it should not cost a
 * round-trip on every dashboard load either).
 */
export function computeBillingStats(
  shops: readonly Shop[],
  latestPerShop: ReadonlyMap<string, SubscriptionEvent>,
): BillingStats {
  const monthlyByCurrency = new Map<string, Money[]>();
  let paidShops = 0;

  for (const shop of shops) {
    if (shop.uninstalledAt !== null) continue;
    const latest = latestPerShop.get(shop.shop);
    if (!latest || !PAID_STATUSES.has(latest.status)) continue;
    paidShops += 1;

    const monthly = monthlyEquivalent(latest);
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
    totalShops: shops.length,
    paidShops,
    freeShops: shops.length - paidShops,
    mrrByCurrency,
  };
}
