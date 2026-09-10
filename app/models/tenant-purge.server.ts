import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { eq, inArray, or, sql, and, notLike } from "drizzle-orm";
import {
  aiRuns,
  notificationLogs,
  notificationOptOuts,
  notificationPreferences,
  pendingUploads,
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
  entitlementOperations,
  entitlementUsage,
  entitlementAllocations,
} from "~/db/schema";
import { getDb } from "~/request-context.server";

const PURGED_SHOP_TABLES = [
  "ai_runs",
  "notification_logs",
  "pending_uploads",
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
  "entitlement_operations",
  "entitlement_usage",
  "entitlement_allocations",
] as const;

export class TenantPurgeRepo {
  async prepareTenantPurge(shop: string): Promise<{ readonly shop: string; readonly attachmentKeys: readonly string[] }> {
    const [attachments, pending] = await Promise.all([
      getDb().select({ key: supportAttachments.r2Key }).from(supportAttachments).where(eq(supportAttachments.shop, shop)),
      getDb().select({ key: pendingUploads.r2Key }).from(pendingUploads).where(eq(pendingUploads.shop, shop)),
    ]);
    const rows = [...attachments, ...pending];
    return { shop, attachmentKeys: rows.map(({ key }) => key) };
  }

  async deleteTenantRows(shop: string): Promise<number> {
    await assertTenantPurgeCoverage();
    const db = getDb();
    const deliveries = db.select({ id: webhookDeliveries.id }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop));
    const deleted = await db.batch([
      db.delete(webhookScopeObservations).where(or(eq(webhookScopeObservations.shop, shop), inArray(webhookScopeObservations.deliveryId, deliveries))),
      db.delete(supportAttachments).where(eq(supportAttachments.shop, shop)),
      db.delete(pendingUploads).where(eq(pendingUploads.shop, shop)),
      db.delete(supportMessages).where(eq(supportMessages.shop, shop)),
      db.delete(supportTickets).where(eq(supportTickets.shop, shop)),
      db.delete(shopSubscriptionItems).where(eq(shopSubscriptionItems.shop, shop)),
      db.delete(shopSubscriptions).where(eq(shopSubscriptions.shop, shop)),
      db.delete(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)),
      db.delete(shopScopeChanges).where(eq(shopScopeChanges.shop, shop)),
      db.delete(shopifyEvents).where(eq(shopifyEvents.shop, shop)),
      db.delete(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)),
      db.delete(aiRuns).where(eq(aiRuns.shop, shop)),
      db.delete(entitlementOperations).where(eq(entitlementOperations.shop, shop)),
      db.delete(entitlementUsage).where(eq(entitlementUsage.shop, shop)),
      db.delete(entitlementAllocations).where(eq(entitlementAllocations.shop, shop)),
      db.delete(notificationLogs).where(eq(notificationLogs.shop, shop)),
      db.delete(notificationPreferences).where(eq(notificationPreferences.scope, shop)),
      db.delete(notificationOptOuts).where(eq(notificationOptOuts.scope, shop)),
      db.delete(shops).where(eq(shops.shop, shop)),
    ]);
    return deleted.reduce((total, result) => total + result.meta.changes, 0);
  }
}

const sqliteMaster = sqliteTable("sqlite_master", { name: text("name").notNull(), type: text("type").notNull() });
const tableColumns = sqliteTable("table_columns", { name: text("name").notNull() });

export async function schemaShopColumns(): Promise<string[]> {
  const tables = await getDb().selectDistinct({ name: sqliteMaster.name })
    .from(sqliteMaster)
    .innerJoin(sql`pragma_table_info(${sqliteMaster.name}) AS table_columns`, eq(tableColumns.name, "shop"))
    .where(and(eq(sqliteMaster.type, "table"), notLike(sqliteMaster.name, "sqlite_%"), notLike(sqliteMaster.name, "_cf_%")))
    .orderBy(sqliteMaster.name);
  return tables.map(({ name }) => name);
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
