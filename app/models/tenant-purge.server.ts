import { eq, inArray, or, sql } from "drizzle-orm";
import {
  aiRuns,
  notificationLogs,
  notificationOptOuts,
  notificationPreferences,
  shopGrantedScopes,
  shopScopeChanges,
  shopSubscriptionItems,
  shopSubscriptions,
  shopifyEvents,
  shops,
  supportAttachments,
  supportMessages,
  supportTickets,
  webhookDeliveries,
  webhookScopeObservations,
} from "~/db/schema";
import { getDb } from "~/request-context.server";

const PURGED_SHOP_TABLES = [
  "ai_runs",
  "notification_logs",
  "shop_granted_scopes",
  "shop_scope_changes",
  "shop_subscription_items",
  "shop_subscriptions",
  "shopify_events",
  "shops",
  "support_attachments",
  "support_messages",
  "support_tickets",
  "webhook_deliveries",
  "webhook_scope_observations",
] as const;

export class TenantPurgeRepo {
  async prepareTenantPurge(shop: string): Promise<{ readonly shop: string; readonly attachmentKeys: readonly string[] }> {
    const rows = await getDb().select({ key: supportAttachments.r2Key }).from(supportAttachments).where(eq(supportAttachments.shop, shop));
    return { shop, attachmentKeys: rows.map(({ key }) => key) };
  }

  async deleteTenantRows(shop: string): Promise<number> {
    await assertTenantPurgeCoverage();
    const db = getDb();
    const deliveries = await db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop));
    const deliveryIds = deliveries.map(({ id }) => id);
    const counts = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(webhookScopeObservations).where(deliveryIds.length ? inArray(webhookScopeObservations.deliveryId, deliveryIds) : sql`0`),
      db.select({ count: sql<number>`count(*)` }).from(supportAttachments).where(eq(supportAttachments.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(supportMessages).where(eq(supportMessages.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopSubscriptions).where(eq(shopSubscriptions.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopSubscriptionItems).where(eq(shopSubscriptionItems.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopScopeChanges).where(eq(shopScopeChanges.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopifyEvents).where(eq(shopifyEvents.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(webhookScopeObservations).where(eq(webhookScopeObservations.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(aiRuns).where(eq(aiRuns.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(notificationLogs).where(eq(notificationLogs.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(notificationPreferences).where(eq(notificationPreferences.scope, shop)),
      db.select({ count: sql<number>`count(*)` }).from(notificationOptOuts).where(eq(notificationOptOuts.scope, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shops).where(eq(shops.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopScopeChanges).where(eq(shopScopeChanges.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(shopifyEvents).where(eq(shopifyEvents.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(aiRuns).where(eq(aiRuns.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(notificationLogs).where(eq(notificationLogs.shop, shop)),
      db.select({ count: sql<number>`count(*)` }).from(notificationPreferences).where(eq(notificationPreferences.scope, shop)),
      db.select({ count: sql<number>`count(*)` }).from(notificationOptOuts).where(eq(notificationOptOuts.scope, shop)),
    ]);
    const deleted = await db.batch([
      db.delete(webhookScopeObservations).where(deliveryIds.length ? or(eq(webhookScopeObservations.shop, shop), inArray(webhookScopeObservations.deliveryId, deliveryIds)) : eq(webhookScopeObservations.shop, shop)),
      db.delete(supportAttachments).where(eq(supportAttachments.shop, shop)),
      db.delete(supportMessages).where(eq(supportMessages.shop, shop)),
      db.delete(supportTickets).where(eq(supportTickets.shop, shop)),
      db.delete(shopSubscriptionItems).where(eq(shopSubscriptionItems.shop, shop)),
      db.delete(shopSubscriptions).where(eq(shopSubscriptions.shop, shop)),
      db.delete(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)),
      db.delete(shopScopeChanges).where(eq(shopScopeChanges.shop, shop)),
      db.delete(shopifyEvents).where(eq(shopifyEvents.shop, shop)),
      db.delete(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)),
      db.delete(aiRuns).where(eq(aiRuns.shop, shop)),
      db.delete(notificationLogs).where(eq(notificationLogs.shop, shop)),
      db.delete(notificationPreferences).where(eq(notificationPreferences.scope, shop)),
      db.delete(notificationOptOuts).where(eq(notificationOptOuts.scope, shop)),
      db.delete(shops).where(eq(shops.shop, shop)),
    ]);
    void deleted;
    return counts.reduce((total, rows) => total + Number(rows[0]?.count ?? 0), 0);
  }
}

export async function schemaShopColumns(): Promise<string[]> {
  const tables = await getDb().all<{ name: string }>(sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'`);
  const scoped: string[] = [];
  for (const table of tables) {
    const columns = await getDb().all<{ name: string }>(sql.raw(`PRAGMA table_info("${table.name.replaceAll('"', '""')}")`));
    if (columns.some(({ name }) => name === "shop")) scoped.push(table.name);
  }
  return scoped.sort();
}

export async function assertTenantPurgeCoverage(): Promise<void> {
  const actual = await schemaShopColumns();
  const expected = [...PURGED_SHOP_TABLES].sort();
  const missing = actual.filter((table) => !expected.some((entry) => entry === table));
  const stale = expected.filter((table) => !actual.includes(table));
  if (missing.length || stale.length) {
    throw new Error(`tenant purge coverage mismatch; missing=${missing.join(",")}; stale=${stale.join(",")}`);
  }
}
