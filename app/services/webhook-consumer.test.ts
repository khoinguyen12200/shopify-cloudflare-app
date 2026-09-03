import { describe, expect, it } from "vitest";
import {
  consumeWebhook,
  type WebhookConsumerDependencies,
} from "./webhook-consumer";
import { isQueuedWebhook } from "~/ports/webhook-queue";

function dependencies(): WebhookConsumerDependencies & { readonly handled: string[] } {
  const handled: string[] = [];
  return {
    deliveries: {
      async get() {
        return {
          id: "delivery-1", shop: "example.myshopify.com", topic: "app/uninstalled",
          status: "queued",
        };
      },
      async markProcessing() { return "claimed" as const; },
      async markProcessed() {},
      async markFailed() {},
    },
    handlers: {
      "app/uninstalled": async (delivery) => { handled.push(delivery.id); },
    },
    now: () => 100,
    handled,
  };
}

describe("consumeWebhook", () => {
  it("rejects malformed queue payloads before they reach a tenant query", () => {
    expect(isQueuedWebhook({ shop: "example.myshopify.com", id: "delivery-1" })).toBe(true);
    expect(isQueuedWebhook({ shop: "example.myshopify.com" })).toBe(false);
  });

  it("processes a queued delivery exactly once", async () => {
    const deps = dependencies();

    await expect(consumeWebhook(deps, { shop: "example.myshopify.com", id: "delivery-1" }))
      .resolves.toEqual({ outcome: "processed", topic: "app/uninstalled" });
    expect(deps.handled).toEqual(["delivery-1"]);
  });

  it("does not dispatch when another worker already owns the delivery", async () => {
    const deps = dependencies();
    const deliveries = {
      ...deps.deliveries,
      async markProcessing() { return "unavailable" as const; },
    };

    await expect(consumeWebhook({ ...deps, deliveries }, {
      shop: "example.myshopify.com", id: "delivery-1",
    })).resolves.toEqual({ outcome: "unavailable", topic: "app/uninstalled" });
    expect(deps.handled).toEqual([]);
  });

  it("discards a delivery already marked processed", async () => {
    const deps = dependencies();
    const deliveries = {
      ...deps.deliveries,
      async get() { return {
        id: "delivery-1", shop: "example.myshopify.com", topic: "app/uninstalled", status: "processed",
      }; },
    };
    await expect(consumeWebhook({ ...deps, deliveries }, {
      shop: "example.myshopify.com", id: "delivery-1",
    })).resolves.toEqual({ outcome: "duplicate", topic: "app/uninstalled" });
    expect(deps.handled).toEqual([]);
  });

  it("persists dead-letter state after the final queue attempt", async () => {
    const deps = dependencies();
    const deadLetters: string[] = [];
    const deliveries = {
      ...deps.deliveries,
      async markDeadLetter(_shop: string, _id: string, _at: number, detail: string) {
        deadLetters.push(detail);
      },
    };
    const failing = { ...deps, deliveries, handlers: { "app/uninstalled": async () => { throw new Error("broken"); } } };

    await expect(consumeWebhook(failing, { shop: "example.myshopify.com", id: "delivery-1", attempts: 9 }))
      .rejects.toThrow("broken");
    expect(deadLetters).toEqual(["broken"]);
  });

  it("does not persist dead-letter state before configured retry limit", async () => {
    const deps = dependencies();
    const deadLetters: string[] = [];
    const deliveries = {
      ...deps.deliveries,
      async markDeadLetter(_shop: string, _id: string, _at: number, detail: string) { deadLetters.push(detail); },
    };
    const failing = { ...deps, deliveries, handlers: { "app/uninstalled": async () => { throw new Error("broken"); } } };

    await expect(consumeWebhook(failing, { shop: "example.myshopify.com", id: "delivery-1", attempts: 8 }))
      .rejects.toThrow("broken");
    expect(deadLetters).toEqual([]);
  });
});
