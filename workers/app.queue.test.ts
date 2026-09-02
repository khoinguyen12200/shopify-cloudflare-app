import { describe, expect, it } from "vitest";
import { handleWebhookQueueBatch } from "../app/services/webhook-queue";

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
});
