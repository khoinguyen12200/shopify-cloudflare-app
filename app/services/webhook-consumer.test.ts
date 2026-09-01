import { describe, expect, it } from "vitest";
import {
  consumeWebhook,
  isQueuedWebhook,
  type WebhookConsumerDependencies,
} from "./webhook-consumer";

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
      .resolves.toBe("processed");
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
    })).resolves.toBe("unavailable");
    expect(deps.handled).toEqual([]);
  });
});
