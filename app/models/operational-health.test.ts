import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { OperationalHealthRepo } from "./operational-health.server";

setupTestDatabase();

describe("OperationalHealthRepo", () => {
  it("reports checkpoint and webhook failure counts plus lifecycle history", async () => {
    const health = await runWithRequestContext(env, async () => {
      await makeDb(env.DB).insert(schema.shopifySyncCheckpoints).values({ name: "partner_history", lastSucceededAt: 100, lastFailedAt: 200, failureCode: "TIMEOUT", failureDetail: "bounded" }).run();
      await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: "health-delivery", eventId: "event", topic: "app/scopes_update", apiVersion: "2025-01", shop: "health.myshopify.com", triggeredAt: 1, receivedAt: 2, payloadHash: "hash", status: "dead_letter" }).run();
      await makeDb(env.DB).insert(schema.shopifyEvents).values([
        { source: "partner_history", eventId: "life", eventType: "INSTALLED", shop: "health.myshopify.com", shopifyShopId: "gid://shopify/Shop/1", occurredAt: 1, synchronizedAt: 1 },
        { source: "partner_history", eventId: "sub", eventType: "UPDATED", shop: "health.myshopify.com", shopifyShopId: "gid://shopify/Shop/1", occurredAt: 2, synchronizedAt: 2 },
      ]).run();
      return new OperationalHealthRepo().read();
    });
    expect(health).toMatchObject({ failedWebhooks: 0, deadLetterWebhooks: 1, lifecycleEvents: 1, subscriptionEvents: 1 });
    expect(health.checkpoint).toMatchObject({ name: "partner_history", lastFailedAt: 200 });
  });

  it("counts the event types sync really stores, not Partner's raw event names or look-alikes", async () => {
    const health = await runWithRequestContext(env, async () => {
      const row = (eventId: string, eventType: string) => ({ source: "partner_history" as const, eventId, eventType, shop: "health.myshopify.com", shopifyShopId: "gid://shopify/Shop/1", occurredAt: 1, synchronizedAt: 1 });
      await makeDb(env.DB).insert(schema.shopifyEvents).values([
        row("r1", "INSTALLED"),
        row("r2", "UNINSTALLED"),
        row("r3", "REACTIVATED"),
        row("r4", "RELATIONSHIP_INSTALLED"),
        row("s1", "CREATED"),
        row("s2", "CANCELLATION_SCHEDULED"),
        row("s3", "SUBSCRIPTION_CREATED"),
        row("x1", "SOMETHING_ELSE"),
      ]).run();
      return new OperationalHealthRepo().read();
    });
    expect(health).toMatchObject({ lifecycleEvents: 3, subscriptionEvents: 2 });
  });
});
