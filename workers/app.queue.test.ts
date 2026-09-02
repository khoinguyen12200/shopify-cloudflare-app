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
          handlers: { "app/uninstalled": async () => { handlerWrites += 1; } },
        }, work),
        log: () => {},
      });
      expect(handlerWrites).toBe(0);
      expect(events).toEqual(["ack"]);
    });
  });

  it("persists dead letter in real D1 on attempt eight and retries queue message", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "worker-dead-letter.myshopify.com";
      const id = "worker-dead-letter-delivery";
      await env.DB.prepare("INSERT INTO webhook_deliveries (id,event_id,topic,api_version,shop,triggered_at,received_at,payload_hash,status) VALUES (?,?,?,?,?,?,?,?,?)")
        .bind(id, "event", "app/uninstalled", "2025-01", shop, 1, 1, "hash", "queued").run();
      const events: string[] = [];
      await handleWebhookQueueBatch({ messages: [{
        body: { shop, id }, attempts: 8,
        ack: () => { events.push("ack"); }, retry: () => { events.push("retry"); },
      }] }, {
        consume: (work) => consumeWebhook({
          deliveries: new WebhookDeliveryRepo(), now: () => 100,
          handlers: { "app/uninstalled": async () => { throw new Error("broken"); } },
        }, work),
        log: () => {},
      });
      const row = await env.DB.prepare("SELECT status, failure_code FROM webhook_deliveries WHERE id = ?").bind(id).first<{ status: string; failure_code: string }>();
      expect(row).toEqual({ status: "dead_letter", failure_code: "dead_letter" });
      expect(events).toEqual(["retry"]);
    });
  });
});
