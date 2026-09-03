import { describe, expect, it } from "vitest";
import { processQueuedWebhookMessage } from "./webhook-queue";

describe("processQueuedWebhookMessage", () => {
  it("acks redacted delivery without dispatching", async () => {
    const events: string[] = [];
    await processQueuedWebhookMessage({
      body: { shop: "redacted.myshopify.com", id: "d1" }, attempts: 1,
      ack: () => events.push("ack"), retry: () => events.push("retry"),
    }, {
      consume: async () => ({ outcome: "missing", topic: null }),
      log: (entry) => { events.push(entry.outcome); },
    });
    expect(events).toEqual(["discarded", "ack"]);
  });

  it("retries failed delivery and dead-letters on final attempt", async () => {
    const events: string[] = [];
    await processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "d1" }, attempts: 8,
      ack: () => events.push("ack"), retry: () => events.push("retry"),
    }, {
      consume: async () => { throw new Error("boom"); },
      log: (entry) => { events.push(entry.outcome); },
    });
    expect(events).toEqual(["failed", "retry"]);
  });

  it("logs consumer topic and handler for processed work", async () => {
    let logged: { readonly topic?: string; readonly handler?: string } | undefined;
    await processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "d1" }, attempts: 1,
      ack() {}, retry() {},
    }, {
      consume: async () => ({ outcome: "processed", topic: "app/uninstalled" }),
      log: (entry) => { logged = entry; },
    });
    expect(logged).toMatchObject({ topic: "app/uninstalled", handler: "app/uninstalled" });
  });

  it("acks processed work when logging fails", async () => {
    const events: string[] = [];
    await processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "d1" }, attempts: 1,
      ack: () => { events.push("ack"); }, retry: () => { events.push("retry"); },
    }, {
      consume: async () => { events.push("consume"); return { outcome: "processed", topic: "app/uninstalled" }; },
      log: async () => { throw new Error("logger unavailable"); },
    });
    expect(events).toEqual(["consume", "ack"]);
  });

  it("retries work when another consumer still owns its processing lease", async () => {
    const events: string[] = [];
    await processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "d1" }, attempts: 1,
      ack: () => events.push("ack"), retry: () => events.push("retry"),
    }, {
      consume: async () => ({ outcome: "unavailable", topic: "app/uninstalled" }),
      log: (entry) => { events.push(entry.outcome); },
    });
    expect(events).toEqual(["unavailable", "retry"]);
  });
});
