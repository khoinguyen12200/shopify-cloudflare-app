import { afterEach, describe, expect, it, vi } from "vitest";
import { processQueuedWebhookMessage } from "./webhook-queue";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("does not write errors for a normally acknowledged delivery", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "delivery-44" }, attempts: 1,
      ack() {}, retry() {},
    }, {
      consume: async () => ({ outcome: "processed", topic: "app/uninstalled" }),
      log() {},
    });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it("acks processed work when logging fails", async () => {
    const events: string[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "d1" }, attempts: 1,
      ack: () => { events.push("ack"); }, retry: () => { events.push("retry"); },
    }, {
      consume: async () => { events.push("consume"); return { outcome: "processed", topic: "app/uninstalled" }; },
      log: async () => { throw new Error("logger unavailable"); },
    });
    expect(events).toEqual(["consume", "ack"]);
    expect(consoleError).toHaveBeenCalledWith(JSON.stringify({
      event: "webhook.queue_log_failed",
      id: "d1",
      attempts: 1,
      error: "logger unavailable",
    }));
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

  it("reports a retry settlement failure and preserves the failure", async () => {
    const error = new Error("retry unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "delivery-42" }, attempts: 3,
      ack() {}, retry() { throw error; },
    }, {
      consume: async () => ({ outcome: "unavailable", topic: "app/uninstalled" }),
      log() {},
    })).rejects.toBe(error);

    expect(consoleError).toHaveBeenCalledWith(JSON.stringify({
      event: "webhook.queue_retry_failed",
      id: "delivery-42",
      attempts: 3,
      error: "retry unavailable",
    }));
  });

  it("reports and preserves an ack settlement failure", async () => {
    const error = new Error("ack unavailable");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(processQueuedWebhookMessage({
      body: { shop: "shop.myshopify.com", id: "delivery-43" }, attempts: 2,
      ack() { throw error; }, retry() {},
    }, {
      consume: async () => ({ outcome: "processed", topic: "app/uninstalled" }),
      log() {},
    })).rejects.toBe(error);

    expect(consoleError).toHaveBeenCalledWith(JSON.stringify({
      event: "webhook.queue_ack_failed",
      id: "delivery-43",
      attempts: 2,
      error: "ack unavailable",
    }));
  });
});
