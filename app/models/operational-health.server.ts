import { count, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { shopifyEvents, shopifySyncCheckpoints, webhookDeliveries } from "~/db/schema";

/**
 * The `event_type` values partner-history sync actually STORES. The adapter
 * (`shopify-partner-events.ts`) stores the lifecycle state, not Partner's
 * `RELATIONSHIP_*` / `SUBSCRIPTION_*` event name, so a prefix match on those
 * names counts nothing. Exact values also let the `event_type` index serve it.
 */
const RELATIONSHIP_EVENT_TYPES = ["INSTALLED", "UNINSTALLED", "DEACTIVATED", "REACTIVATED"];
const SUBSCRIPTION_EVENT_TYPES = ["CREATED", "UPDATED", "CANCELLATION_SCHEDULED", "CANCELED", "FROZEN", "UNFROZEN"];

export class OperationalHealthRepo {
  async read() {
    const db = getDb();
    const [checkpointRows, webhookRows, lifecycleRows, subscriptionRows] = await Promise.all([
      db.select().from(shopifySyncCheckpoints).where(eq(shopifySyncCheckpoints.name, "partner_history")).limit(1),
      db.select({ status: webhookDeliveries.status, count: sql<number>`count(*)` })
        .from(webhookDeliveries).where(inArray(webhookDeliveries.status, ["failed", "dead_letter"]))
        .groupBy(webhookDeliveries.status),
      db.select({ count: count() }).from(shopifyEvents).where(inArray(shopifyEvents.eventType, RELATIONSHIP_EVENT_TYPES)),
      db.select({ count: count() }).from(shopifyEvents).where(inArray(shopifyEvents.eventType, SUBSCRIPTION_EVENT_TYPES)),
    ]);
    const counts = new Map(webhookRows.map((row) => [row.status, Number(row.count)]));
    return {
      checkpoint: checkpointRows[0] ?? null,
      failedWebhooks: counts.get("failed") ?? 0,
      deadLetterWebhooks: counts.get("dead_letter") ?? 0,
      lifecycleEvents: Number(lifecycleRows[0]?.count ?? 0),
      subscriptionEvents: Number(subscriptionRows[0]?.count ?? 0),
    };
  }
}
