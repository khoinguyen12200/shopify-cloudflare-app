import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { OperationalHealthRepo } from "./operational-health.server";

setupTestDatabase();

describe("OperationalHealthRepo", () => {
  it("reports checkpoint and webhook failure counts plus lifecycle history", async () => {
    const health = await runWithRequestContext(env, async () => {
      await env.DB.prepare("INSERT INTO shopify_sync_checkpoints (name, last_succeeded_at, last_failed_at, failure_code, failure_detail) VALUES (?, ?, ?, ?, ?)")
        .bind("partner_history", 100, 200, "TIMEOUT", "bounded").run();
      await env.DB.prepare("INSERT INTO webhook_deliveries (id, event_id, topic, api_version, shop, triggered_at, received_at, payload_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind("health-delivery", "event", "app/scopes_update", "2025-01", "health.myshopify.com", 1, 2, "hash", "dead_letter").run();
      await env.DB.prepare("INSERT INTO shopify_events (source, event_id, event_type, shop, shopify_shop_id, occurred_at, synchronized_at) VALUES (?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?)")
        .bind("partner_history", "life", "RELATIONSHIP_INSTALLED", "health.myshopify.com", "gid://shopify/Shop/1", 1, 1, "partner_history", "sub", "SUBSCRIPTION_UPDATED", "health.myshopify.com", "gid://shopify/Shop/1", 2, 2).run();
      return new OperationalHealthRepo().read();
    });
    expect(health).toMatchObject({ failedWebhooks: 0, deadLetterWebhooks: 1, lifecycleEvents: 1, subscriptionEvents: 1 });
    expect(health.checkpoint).toMatchObject({ name: "partner_history", lastFailedAt: 200 });
  });
});
