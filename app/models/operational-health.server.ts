import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { shopifyEvents, shopifySyncCheckpoints, webhookDeliveries } from "~/db/schema";

export class OperationalHealthRepo {
  async read() {
    const db = getDb();
    const [checkpointRows, webhookRows, lifecycleRows, subscriptionRows] = await Promise.all([
      db.select().from(shopifySyncCheckpoints).where(eq(shopifySyncCheckpoints.name, "partner_history")).limit(1),
      db.select({ status: webhookDeliveries.status, count: sql<number>`count(*)` })
        .from(webhookDeliveries).where(inArray(webhookDeliveries.status, ["failed", "dead_letter"]))
        .groupBy(webhookDeliveries.status),
      db.select({ count: sql<number>`count(*)` }).from(shopifyEvents).where(sql`${shopifyEvents.eventType} LIKE 'RELATIONSHIP_%'`),
      db.select({ count: sql<number>`count(*)` }).from(shopifyEvents).where(sql`${shopifyEvents.eventType} LIKE 'SUBSCRIPTION_%'`),
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
