import { drizzle } from "drizzle-orm/d1";
import { count, eq, inArray, and, isTable, getTableName } from "drizzle-orm";
import * as schema from "~/db/schema";
import { aiRuns, entitlementAllocations, entitlementOperations, entitlementUsage, notificationLogs, notificationOptOuts, notificationPreferences, pendingUploads, shopGrantedScopes, shopScopeChanges, shopSubscriptionItems, shopSubscriptions, shopifyEvents, shopifySyncCheckpoints, shops, supportAttachments, supportMessages, supportTickets, webhookDeliveries, webhookScopeObservations } from "~/db/schema";
import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { assertTenantPurgeCoverage, schemaShopColumns, TenantPurgeRepo } from "./tenant-purge.server";

setupTestDatabase();
const db = drizzle(env.DB);

describe("TenantPurgeRepo", () => {
  it("inventory covers every table with a shop column", async () => {
    const tables = await runWithRequestContext(env, schemaShopColumns);
    expect(tables).toEqual([
      "ai_runs", "entitlement_allocations", "entitlement_operations", "entitlement_usage", "notification_logs", "pending_uploads", "shop_granted_scopes", "shop_scope_changes", "shop_subscription_items",
      "shop_subscriptions", "shopify_events", "shops", "support_attachments",
      "support_messages", "support_tickets", "webhook_deliveries", "webhook_scope_observations",
    ]);
  });

  it("fails coverage check when a new shop-scoped table appears", async () => {
    await runWithRequestContext(env, async () => {
      await env.DB.prepare("CREATE TABLE purge_guard_future (id TEXT PRIMARY KEY, shop TEXT NOT NULL)").run();
      await expect(assertTenantPurgeCoverage()).rejects.toThrow("purge_guard_future");
      await env.DB.prepare("DROP TABLE purge_guard_future").run();
    });
  });

  it("lists attachment keys and deletes every shop-scoped row", async () => {
    const shop = "purge-all.myshopify.com";
    const remaining = await runWithRequestContext(env, async () => {
      await db.insert(shops).values({ shop: shop, installedAt: 1 }).run();
      await db.insert(notificationLogs).values({ id: "log-1", event: "x", channel: "email", recipient: "x@y.com", status: "sent", shop: shop, createdAt: 1 }).run();
      const repo = new TenantPurgeRepo();
      await db.insert(supportTickets).values({ id: "ticket-1", shop: shop, shopName: "Shop", category: "question", subject: "Subject", lastAuthor: "merchant", lastMessageAt: 1, createdAt: 1 }).run();
      await db.insert(supportMessages).values({ id: "msg-1", ticketId: "ticket-1", shop: shop, author: "merchant", authorName: "M", body: "Body", createdAt: 1 }).run();
      await db.insert(supportAttachments).values({ id: "att-1", messageId: "msg-1", shop: shop, r2Key: "uploads/purge", filename: "a.txt", contentType: "text/plain", sizeBytes: 1, createdAt: 1 }).run();
      const prepared = await repo.prepareTenantPurge(shop);
      await repo.deleteTenantRows(shop);
      const total = await db.select({ count: count() }).from(shops).where(inArray(shops.shop, [shop, "other.myshopify.com"])).get();
      return { prepared, count: Number(total?.count ?? 0) };
    });
    expect(remaining.prepared.attachmentKeys).toEqual(["uploads/purge"]);
    expect(remaining.count).toBe(0);
  });

  it("counts every directly deleted shop row", async () => {
    const affected = await runWithRequestContext(env, async () => {
      const shop = "count-all.myshopify.com";
      await db.insert(shops).values({ shop: shop, installedAt: 1 }).run();
      await db.insert(notificationLogs).values({ id: "count-log", event: "x", channel: "email", recipient: "x@y.com", status: "sent", shop: shop, createdAt: 1 }).run();
      return new TenantPurgeRepo().deleteTenantRows(shop);
    });
    expect(affected).toBe(2);
  });

  it("counts pending uploads and scope observations exactly once", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "count-observations.myshopify.com";
      await db.insert(shops).values({ shop, installedAt: 1 });
      await db.insert(webhookDeliveries).values({ id: "count-delivery", eventId: "event", topic: "app/uninstalled", apiVersion: "2025-01", shop, triggeredAt: 1, receivedAt: 1, payloadHash: "hash" });
      await db.insert(webhookScopeObservations).values({ deliveryId: "count-delivery", shop, scope: "read_products" });
      expect(await new TenantPurgeRepo().deleteTenantRows(shop)).toBe(3);
      await db.insert(pendingUploads).values({ id: "count-pending", shop, r2Key: "pending", filename: "a.txt", contentType: "text/plain", sizeBytes: 1, createdAt: 1, expiresAt: 2 });
      expect(await new TenantPurgeRepo().deleteTenantRows(shop)).toBe(1);
    });
  });

  it("counts entitlement rows exactly once", async () => {
    const affected = await runWithRequestContext(env, async () => {
      const shop = "count-entitlements.myshopify.com";
      await db.insert(shops).values({ shop: shop, installedAt: 1 }).run();
      await db.insert(entitlementUsage).values({ shop: shop, key: "quota", period: "lifetime", committed: 1, held: 0, updatedAt: 1 }).run();
      await db.insert(entitlementOperations).values({ shop: shop, operationId: "op-count", key: "quota", period: "lifetime", requestedAmount: 1, reservedAmount: 1, subscriptionRevision: 1, state: "held", createdAt: 1, updatedAt: 1 }).run();
      await db.insert(entitlementAllocations).values({ shop: shop, key: "quota", allocationId: "alloc-count", operationId: "op-alloc-count", subscriptionRevision: 1, state: "allocated", createdAt: 1, updatedAt: 1 }).run();
      return new TenantPurgeRepo().deleteTenantRows(shop);
    });
    expect(affected).toBe(4);
  });

  it("purges every tenant table without touching another tenant", async () => {
    const target = "target.myshopify.com";
    const other = "other.myshopify.com";
    await runWithRequestContext(env, async () => {
      for (const shop of [target, other]) {
        await db.insert(shops).values({ shop: shop, installedAt: 1 }).run();
        await db.insert(webhookDeliveries).values({ id: `delivery-${shop}`, eventId: "event", topic: "app/uninstalled", apiVersion: "2025-01", shop: shop, triggeredAt: 1, receivedAt: 1, payloadHash: "hash" }).run();
        await db.insert(webhookScopeObservations).values({ deliveryId: `delivery-${shop}`, shop: shop, scope: "read_products" }).run();
        await db.insert(shopifyEvents).values({ source: "webhook_observation", eventId: `event-${shop}`, eventType: "installed", shop: shop, shopifyShopId: "gid", occurredAt: 1, synchronizedAt: 1 }).run();
        await db.insert(shopSubscriptions).values({ shop: shop, subscriptionId: "sub", status: "ACTIVE", appliedOccurredAt: 1, appliedExternalId: "event" }).run();
        await db.insert(shopSubscriptionItems).values({ shop: shop, subscriptionId: "sub", position: 0, itemType: "flat" }).run();
        await db.insert(shopGrantedScopes).values({ shop: shop, scope: "read_products", grantedAt: 1 }).run();
        await db.insert(shopScopeChanges).values({ id: `change-${shop}`, shop: shop, source: "webhook", occurredAt: 1 }).run();
        await db.insert(aiRuns).values({ id: `run-${shop}`, role: "writing", modelId: "model", feature: "test", shop: shop, status: "ok", createdAt: 1 }).run();
        await db.insert(notificationLogs).values({ id: `log-${shop}`, event: "test", channel: "email", recipient: "x@y.com", status: "sent", shop: shop, createdAt: 1 }).run();
        await db.insert(notificationPreferences).values({ scope: shop, event: "test", channel: "email", enabled: true, updatedAt: 1 }).run();
        await db.insert(notificationOptOuts).values({ scope: shop, channel: "email", address: `${shop}@example.com`, optedOutAt: 1, source: "test" }).run();
        await db.insert(supportTickets).values({ id: `ticket-${shop}`, shop: shop, shopName: "Shop", category: "question", subject: "Subject", lastAuthor: "merchant", lastMessageAt: 1, createdAt: 1 }).run();
        await db.insert(supportMessages).values({ id: `message-${shop}`, ticketId: `ticket-${shop}`, shop: shop, author: "merchant", authorName: "M", body: "Body", createdAt: 1 }).run();
        await db.insert(supportAttachments).values({ id: `attachment-${shop}`, messageId: `message-${shop}`, shop: shop, r2Key: `uploads/${shop}`, filename: "a.txt", contentType: "text/plain", sizeBytes: 1, createdAt: 1 }).run();
        await db.insert(pendingUploads).values({ id: `pending-${shop}`, shop: shop, r2Key: `uploads/pending-${shop}`, filename: "draft.txt", contentType: "text/plain", sizeBytes: 1, createdAt: 1, expiresAt: 2 }).run();
        await db.insert(entitlementUsage).values({ shop: shop, key: "test", period: "lifetime", committed: 1, held: 0, updatedAt: 1 }).run();
        await db.insert(entitlementOperations).values({ shop: shop, operationId: `op-${shop}`, key: "test", period: "lifetime", requestedAmount: 1, reservedAmount: 1, subscriptionRevision: 1, state: "held", createdAt: 1, updatedAt: 1 }).run();
        await db.insert(entitlementAllocations).values({ shop: shop, key: "staff.max", allocationId: `alloc-${shop}`, operationId: `op-alloc-${shop}`, subscriptionRevision: 1, state: "allocated", createdAt: 1, updatedAt: 1 }).run();
      }
      await db.insert(notificationPreferences).values({ scope: "global", event: "test", channel: "email", enabled: true, updatedAt: 1 }).run();
      await db.insert(notificationOptOuts).values({ scope: "global", channel: "email", address: "global@example.com", optedOutAt: 1, source: "test" }).run();
      await db.insert(shopifySyncCheckpoints).values({ name: "tenant-purge-proof", lastSucceededAt: 1 }).run();
      await new TenantPurgeRepo().deleteTenantRows(target);
      for (const tableName of await schemaShopColumns()) {
        const table = Object.values(schema).find((value) => isTable(value) && getTableName(value) === tableName);
        if (!table || !("shop" in table)) throw new Error(`Missing tenant table ${tableName}`);
        const targetRows = await db.select({ count: count() }).from(table).where(eq(table.shop, target)).get();
        const otherRows = await db.select({ count: count() }).from(table).where(eq(table.shop, other)).get();
        expect(Number(targetRows?.count)).toBe(0);
        expect(Number(otherRows?.count)).toBeGreaterThan(0);
      }
      const checkpoint = await db.select({ count: count() }).from(shopifySyncCheckpoints).where(eq(shopifySyncCheckpoints.name, "tenant-purge-proof")).get();
      expect(Number(checkpoint?.count)).toBe(1);
      const preferences = await db.select({ scope: notificationPreferences.scope }).from(notificationPreferences).where(and(eq(notificationPreferences.event, "test"), eq(notificationPreferences.channel, "email"))).orderBy(notificationPreferences.scope).all();
      expect(preferences.map(({ scope }) => scope)).toEqual(["global", other]);
      const optOuts = await db.select({ scope: notificationOptOuts.scope }).from(notificationOptOuts).where(eq(notificationOptOuts.channel, "email")).orderBy(notificationOptOuts.scope).all();
      expect(optOuts.map(({ scope }) => scope)).toEqual(["global", other]);
    });
  });
});
