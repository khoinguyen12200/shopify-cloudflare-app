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

  it("counts every directly deleted shop row", async () => {
    const affected = await runWithRequestContext(env, async () => {
      const shop = "count-all.myshopify.com";
      await env.DB.prepare("INSERT INTO shops (shop, installed_at) VALUES (?, ?)").bind(shop, 1).run();
      await env.DB.prepare("INSERT INTO notification_logs (id,event,channel,recipient,status,shop,created_at) VALUES (?,?,?,?,?,?,?)").bind("count-log", "x", "email", "x@y.com", "sent", shop, 1).run();
      return new TenantPurgeRepo().deleteTenantRows(shop);
    });
    expect(affected).toBe(2);
  });

  it("purges every tenant table without touching another tenant", async () => {
    const target = "target.myshopify.com";
    const other = "other.myshopify.com";
    await runWithRequestContext(env, async () => {
      for (const shop of [target, other]) {
        await env.DB.prepare("INSERT INTO shops (shop, installed_at) VALUES (?, ?)").bind(shop, 1).run();
        await env.DB.prepare("INSERT INTO webhook_deliveries (id,event_id,topic,api_version,shop,triggered_at,received_at,payload_hash) VALUES (?,?,?,?,?,?,?,?)").bind(`delivery-${shop}`, "event", "app/uninstalled", "2025-01", shop, 1, 1, "hash").run();
        await env.DB.prepare("INSERT INTO webhook_scope_observations (delivery_id,shop,scope) VALUES (?,?,?)").bind(`delivery-${shop}`, shop, "read_products").run();
        await env.DB.prepare("INSERT INTO shopify_events (source,event_id,event_type,shop,shopify_shop_id,occurred_at,synchronized_at) VALUES (?,?,?,?,?,?,?)").bind("webhook_observation", `event-${shop}`, "installed", shop, "gid", 1, 1).run();
        await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id) VALUES (?,?,?,?,?)").bind(shop, "sub", "ACTIVE", 1, "event").run();
        await env.DB.prepare("INSERT INTO shop_subscription_items (shop,subscription_id,position,item_type) VALUES (?,?,?,?)").bind(shop, "sub", 0, "flat").run();
        await env.DB.prepare("INSERT INTO shop_granted_scopes (shop,scope,granted_at) VALUES (?,?,?)").bind(shop, "read_products", 1).run();
        await env.DB.prepare("INSERT INTO shop_scope_changes (id,shop,source,occurred_at) VALUES (?,?,?,?)").bind(`change-${shop}`, shop, "webhook", 1).run();
        await env.DB.prepare("INSERT INTO ai_runs (id,role,model_id,feature,shop,status,created_at) VALUES (?,?,?,?,?,?,?)").bind(`run-${shop}`, "support_draft", "model", "test", shop, "ok", 1).run();
        await env.DB.prepare("INSERT INTO notification_logs (id,event,channel,recipient,status,shop,created_at) VALUES (?,?,?,?,?,?,?)").bind(`log-${shop}`, "test", "email", "x@y.com", "sent", shop, 1).run();
        await env.DB.prepare("INSERT INTO notification_preferences (scope,event,channel,enabled,updated_at) VALUES (?,?,?,?,?)").bind(shop, "test", "email", 1, 1).run();
        await env.DB.prepare("INSERT INTO notification_opt_outs (scope,channel,address,opted_out_at,source) VALUES (?,?,?,?,?)").bind(shop, "email", `${shop}@example.com`, 1, "test").run();
        await env.DB.prepare("INSERT INTO support_tickets (id,shop,shop_name,category,subject,last_author,last_message_at,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(`ticket-${shop}`, shop, "Shop", "other", "Subject", "merchant", 1, 1).run();
        await env.DB.prepare("INSERT INTO support_messages (id,ticket_id,shop,author,author_name,body,created_at) VALUES (?,?,?,?,?,?,?)").bind(`message-${shop}`, `ticket-${shop}`, shop, "merchant", "M", "Body", 1).run();
        await env.DB.prepare("INSERT INTO support_attachments (id,message_id,shop,r2_key,filename,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(`attachment-${shop}`, `message-${shop}`, shop, `uploads/${shop}`, "a.txt", "text/plain", 1, 1).run();
      }
      await env.DB.prepare("INSERT INTO notification_preferences (scope,event,channel,enabled,updated_at) VALUES (?,?,?,?,?)").bind("global", "test", "email", 1, 1).run();
      await env.DB.prepare("INSERT INTO notification_opt_outs (scope,channel,address,opted_out_at,source) VALUES (?,?,?,?,?)").bind("global", "email", "global@example.com", 1, "test").run();
      await env.DB.prepare("INSERT INTO shopify_sync_checkpoints (name, last_succeeded_at) VALUES (?, ?)").bind("tenant-purge-proof", 1).run();
      await new TenantPurgeRepo().deleteTenantRows(target);
      for (const table of await schemaShopColumns()) {
        const targetRows = await env.DB.prepare(`SELECT count(*) AS count FROM ${table} WHERE shop = ?`).bind(target).first<{ count: number }>();
        const otherRows = await env.DB.prepare(`SELECT count(*) AS count FROM ${table} WHERE shop = ?`).bind(other).first<{ count: number }>();
        expect(Number(targetRows?.count)).toBe(0);
        expect(Number(otherRows?.count)).toBeGreaterThan(0);
      }
      const checkpoint = await env.DB.prepare("SELECT count(*) AS count FROM shopify_sync_checkpoints WHERE name = ?").bind("tenant-purge-proof").first<{ count: number }>();
      expect(Number(checkpoint?.count)).toBe(1);
      const preferences = await env.DB.prepare("SELECT scope FROM notification_preferences WHERE event = ? AND channel = ? ORDER BY scope").bind("test", "email").all<{ scope: string }>();
      expect(preferences.results.map(({ scope }) => scope)).toEqual(["global", other]);
      const optOuts = await env.DB.prepare("SELECT scope FROM notification_opt_outs WHERE channel = ? ORDER BY scope").bind("email").all<{ scope: string }>();
      expect(optOuts.results.map(({ scope }) => scope)).toEqual(["global", other]);
    });
  });
});
