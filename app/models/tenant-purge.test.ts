import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { assertTenantPurgeCoverage, schemaShopColumns, TenantPurgeRepo } from "./tenant-purge.server";

setupTestDatabase();

describe("TenantPurgeRepo", () => {
  it("inventory covers every table with a shop column", async () => {
    const tables = await runWithRequestContext(env, schemaShopColumns);
    expect(tables).toEqual([
      "ai_runs", "notification_logs", "shop_granted_scopes", "shop_scope_changes", "shop_subscription_items",
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
      await env.DB.prepare("INSERT INTO shops (shop, installed_at) VALUES (?, ?)").bind(shop, 1).run();
      await env.DB.prepare("INSERT INTO notification_logs (id,event,channel,recipient,status,shop,created_at) VALUES (?,?,?,?,?,?,?)").bind("log-1", "x", "email", "x@y.com", "sent", shop, 1).run();
      const repo = new TenantPurgeRepo();
      await env.DB.prepare("INSERT INTO support_tickets (id,shop,shop_name,category,subject,last_author,last_message_at,created_at) VALUES (?,?,?,?,?,?,?,?)").bind("ticket-1", shop, "Shop", "other", "Subject", "merchant", 1, 1).run();
      await env.DB.prepare("INSERT INTO support_messages (id,ticket_id,shop,author,author_name,body,created_at) VALUES (?,?,?,?,?,?,?)").bind("msg-1", "ticket-1", shop, "merchant", "M", "Body", 1).run();
      await env.DB.prepare("INSERT INTO support_attachments (id,message_id,shop,r2_key,filename,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)").bind("att-1", "msg-1", shop, "uploads/purge", "a.txt", "text/plain", 1, 1).run();
      const prepared = await repo.prepareTenantPurge(shop);
      await repo.deleteTenantRows(shop);
      const count = await env.DB.prepare("SELECT count(*) AS count FROM shops WHERE shop = ? OR shop = ?").bind(shop, "other.myshopify.com").first<{ count: number }>();
      return { prepared, count: Number(count?.count ?? 0) };
    });
    expect(remaining.prepared.attachmentKeys).toEqual(["uploads/purge"]);
    expect(remaining.count).toBe(0);
  });
});
