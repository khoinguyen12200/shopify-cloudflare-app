import { eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { handleWebhookQueueBatch } from "../app/services/webhook-queue";
import { consumeWebhook } from "../app/services/webhook-consumer";
import { WebhookDeliveryRepo } from "../app/models/webhook-deliveries.server";
import { runWithRequestContext } from "../app/request-context.server";
import { setupTestDatabase } from "../app/test/db";

setupTestDatabase();

describe("handleWebhookQueueBatch", () => {
  it("acks missing delivery without handler writes", async () => {
    const events: string[] = [];
    await handleWebhookQueueBatch({
      messages: [{
        body: { shop: "redacted.myshopify.com", id: "delivery-1" },
        attempts: 1,
        ack: () => events.push("ack"),
        retry: () => events.push("retry"),
      }],
    }, {
      consume: async () => ({ outcome: "missing", topic: null }),
      log: (entry) => { events.push(entry.outcome); },
    });
    expect(events).toEqual(["discarded", "ack"]);
  });

  it("retries failed final attempt after consumer persists dead letter", async () => {
    const events: string[] = [];
    await handleWebhookQueueBatch({
      messages: [{
        body: { shop: "shop.myshopify.com", id: "delivery-1" },
        attempts: 8,
        ack: () => events.push("ack"),
        retry: () => events.push("retry"),
      }],
    }, {
      consume: async () => {
        events.push("dead-letter-persisted");
        throw new Error("broken");
      },
      log: (entry) => { events.push(entry.outcome); },
    });
    expect(events).toEqual(["dead-letter-persisted", "failed", "retry"]);
  });

  it("skips missing redacted delivery with real D1 consumer", async () => {
    await runWithRequestContext(env, async () => {
      let handlerWrites = 0;
      const events: string[] = [];
      await handleWebhookQueueBatch({ messages: [{
        body: { shop: "redacted.myshopify.com", id: "missing-worker-delivery" }, attempts: 1,
        ack: () => { events.push("ack"); }, retry: () => { events.push("retry"); },
      }] }, {
        consume: (work) => consumeWebhook({
          deliveries: new WebhookDeliveryRepo(), now: () => 100,
          handlers: { "app/uninstalled": async () => { handlerWrites += 1; }, "app/scopes_update": async () => {} },
        }, work),
        log: () => {},
      });
      expect(handlerWrites).toBe(0);
      expect(events).toEqual(["ack"]);
    });
  });

  it("persists dead letter in real D1 on final attempt and retries queue message", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "worker-dead-letter.myshopify.com";
      const id = "worker-dead-letter-delivery";
      await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: id, eventId: "event", topic: "app/uninstalled", apiVersion: "2025-01", shop: shop, triggeredAt: 1, receivedAt: 1, payloadHash: "hash", status: "queued" }).run();
      const events: string[] = [];
      await handleWebhookQueueBatch({ messages: [{
        body: { shop, id }, attempts: 9,
        ack: () => { events.push("ack"); }, retry: () => { events.push("retry"); },
      }] }, {
        consume: (work) => consumeWebhook({
          deliveries: new WebhookDeliveryRepo(), now: () => 100,
          handlers: { "app/uninstalled": async () => { throw new Error("broken"); }, "app/scopes_update": async () => {} },
        }, work),
        log: () => {},
      });
      const row = await makeDb(env.DB).select({ status: schema.webhookDeliveries.status, failure_code: schema.webhookDeliveries.failureCode }).from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, id)).get();
      expect(row).toEqual({ status: "dead_letter", failure_code: "dead_letter" });
      expect(events).toEqual(["retry"]);
    });
  });

  it("persists unsupported topic as dead letter on final attempt and retries queue message", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "worker-unsupported-topic.myshopify.com";
      const id = "worker-unsupported-topic-delivery";
      await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: id, eventId: "event", topic: "orders/created", apiVersion: "2025-01", shop: shop, triggeredAt: 1, receivedAt: 1, payloadHash: "hash", status: "queued" }).run();
      const events: string[] = [];
      await handleWebhookQueueBatch({ messages: [{
        body: { shop, id }, attempts: 9,
        ack: () => { events.push("ack"); }, retry: () => { events.push("retry"); },
      }] }, {
        consume: (work) => consumeWebhook({
          deliveries: new WebhookDeliveryRepo(), now: () => 100,
          handlers: { "app/uninstalled": async () => {}, "app/scopes_update": async () => {} },
        }, work),
        log: () => {},
      });
      const row = await makeDb(env.DB).select({ status: schema.webhookDeliveries.status, failure_code: schema.webhookDeliveries.failureCode }).from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, id)).get();
      expect(row).toEqual({ status: "dead_letter", failure_code: "dead_letter" });
      expect(events).toEqual(["ack"]);
    });
  });
});
