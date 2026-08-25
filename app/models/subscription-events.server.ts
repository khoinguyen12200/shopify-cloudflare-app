import { desc, eq } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { subscriptionEvents, type SubscriptionEvent } from "~/db/schema";
import type { SubscriptionEventInput } from "~/billing/subscription-event";

/**
 * The `app_subscriptions/update` webhook's paper trail. The ONLY place
 * `subscription_events` is queried — see @rules/data.md.
 */
export class SubscriptionEventRepo {
  /**
   * Record one webhook delivery. Idempotent: `(subscriptionId, shopifyUpdatedAt)`
   * is UNIQUE, so a replayed delivery for an update already recorded is a
   * silent no-op rather than a duplicate row.
   */
  async record(
    shop: string,
    id: string,
    event: SubscriptionEventInput,
    receivedAt: number,
  ): Promise<void> {
    await getDb()
      .insert(subscriptionEvents)
      .values({
        id,
        shop,
        subscriptionId: event.subscriptionId,
        name: event.name,
        status: event.status,
        planHandle: event.planHandle,
        interval: event.interval,
        priceAmount: event.price.amount,
        priceCurrency: event.price.currency,
        cappedAmountAmount: event.cappedAmount?.amount ?? null,
        cappedAmountCurrency: event.cappedAmount?.currency ?? null,
        shopifyCreatedAt: event.shopifyCreatedAt,
        shopifyUpdatedAt: event.shopifyUpdatedAt,
        receivedAt,
      })
      .onConflictDoNothing({
        target: [subscriptionEvents.subscriptionId, subscriptionEvents.shopifyUpdatedAt],
      });
  }

  /** A shop's full history, newest Shopify-reported update first. */
  async listForShop(shop: string): Promise<SubscriptionEvent[]> {
    return getDb()
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.shop, shop))
      .orderBy(desc(subscriptionEvents.shopifyUpdatedAt));
  }

  /** The shop's current subscription state, or undefined if it never had one. */
  async latestForShop(shop: string): Promise<SubscriptionEvent | undefined> {
    const [row] = await getDb()
      .select()
      .from(subscriptionEvents)
      .where(eq(subscriptionEvents.shop, shop))
      .orderBy(desc(subscriptionEvents.shopifyUpdatedAt))
      .limit(1);
    return row;
  }

  /** Across every shop, newest first — the internal console's activity feed. */
  async listRecent(limit: number): Promise<SubscriptionEvent[]> {
    return getDb()
      .select()
      .from(subscriptionEvents)
      .orderBy(desc(subscriptionEvents.shopifyUpdatedAt))
      .limit(limit);
  }

  /**
   * Every shop's current subscription state, in ONE query — never one query
   * per shop (@rules/data.md). Reads every row ordered newest-first and keeps
   * the first one seen per shop, which the ORDER BY guarantees is the latest.
   */
  async latestPerShop(): Promise<Map<string, SubscriptionEvent>> {
    const rows = await getDb()
      .select()
      .from(subscriptionEvents)
      .orderBy(desc(subscriptionEvents.shopifyUpdatedAt));

    const latest = new Map<string, SubscriptionEvent>();
    for (const row of rows) {
      if (!latest.has(row.shop)) latest.set(row.shop, row);
    }
    return latest;
  }
}
