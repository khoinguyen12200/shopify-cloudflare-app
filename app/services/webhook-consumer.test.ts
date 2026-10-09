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
          status: "queued", triggeredAt: 50,
        };
      },
      async markProcessing() { return "claimed" as const; },
      async markProcessed() {},
      async markFailed() {},
    },
    handlers: {
      "app/uninstalled": async (delivery) => { handled.push(delivery.id); },
      "app/scopes_update": async () => {},
      "customers/data_request": async () => {},
      "customers/redact": async () => {},
      "shop/redact": async (delivery) => { handled.push(`redact:${delivery.id}`); },
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
        id: "delivery-1", shop: "example.myshopify.com", topic: "app/uninstalled", status: "processed", triggeredAt: 50,
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
    const failing = { ...deps, deliveries, handlers: { ...deps.handlers, "app/uninstalled": async () => { throw new Error("broken"); } } };

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
    const failing = { ...deps, deliveries, handlers: { ...deps.handlers, "app/uninstalled": async () => { throw new Error("broken"); } } };

    await expect(consumeWebhook(failing, { shop: "example.myshopify.com", id: "delivery-1", attempts: 8 }))
      .rejects.toThrow("broken");
    expect(deadLetters).toEqual([]);
  });

  it("dead-letters an unknown stored topic and returns unsupported on retries", async () => {
    const deps = dependencies();
    const states: string[] = [];
    const deliveries = {
      ...deps.deliveries,
      async get() {
        return { id: "delivery-1", shop: "example.myshopify.com", topic: "retired/topic", status: states.includes("dead_letter") ? "dead_letter" : "queued", triggeredAt: 50, failureCode: states.includes("dead_letter") ? "dead_letter" : null, processingStartedAt: null };
      },
      async markFailed() { states.push("failed"); },
      async markDeadLetter() { states.push("dead_letter"); },
    };
    const first = await consumeWebhook({ ...deps, deliveries }, { shop: "example.myshopify.com", id: "delivery-1" });
    const second = await consumeWebhook({ ...deps, deliveries }, { shop: "example.myshopify.com", id: "delivery-1" });
    expect(first).toEqual({ outcome: "unsupported", topic: "retired/topic" });
    expect(second).toEqual({ outcome: "unsupported", topic: "retired/topic" });
    expect(states).toEqual(["failed", "dead_letter"]);
  });

  describe("shop standing", () => {
    const unknown = async () => ({ tombstoned: false, hasShopRecord: false });
    const tombstoned = async () => ({ tombstoned: true, hasShopRecord: false });
    const work = { shop: "example.myshopify.com", id: "delivery-1" };

    function scopesDeps(shopStanding: () => Promise<{ tombstoned: boolean; hasShopRecord: boolean }>) {
      const deps = dependencies();
      const deleted: string[] = [];
      const deliveries = {
        ...deps.deliveries,
        async get() { return { id: "delivery-1", shop: work.shop, topic: "app/scopes_update", status: "queued", triggeredAt: 50 }; },
        async deleteDelivery(_shop: string, id: string) { deleted.push(id); },
      };
      return { ...deps, deliveries, shopStanding, deleted, handlers: { ...deps.handlers, "app/scopes_update": async () => { deps.handled.push("scopes"); } } };
    }

    it("runs an uninstall for an unknown shop and keeps the delivery row", async () => {
      const deps = { ...dependencies(), shopStanding: unknown };
      const deleted: string[] = [];
      const deliveries = { ...deps.deliveries, async deleteDelivery(_s: string, id: string) { deleted.push(id); } };
      await expect(consumeWebhook({ ...deps, deliveries }, work)).resolves.toEqual({ outcome: "processed", topic: "app/uninstalled" });
      expect(deps.handled).toEqual(["delivery-1"]);
      expect(deleted).toEqual([]);
    });

    it("discards and deletes a tombstoned shop's delivery without dispatching", async () => {
      const deps = scopesDeps(tombstoned);
      await expect(consumeWebhook(deps, work)).resolves.toEqual({ outcome: "missing", topic: "app/scopes_update" });
      expect(deps.deleted).toEqual(["delivery-1"]);
      expect(deps.handled).toEqual([]);
    });

    it("defers a scopes update for an unknown shop with a growing delay, without claiming it", async () => {
      const deps = scopesDeps(unknown);
      await expect(consumeWebhook(deps, { ...work, attempts: 1 })).resolves.toEqual({ outcome: "deferred", topic: "app/scopes_update", retryDelaySeconds: 60 });
      await expect(consumeWebhook(deps, { ...work, attempts: 3 })).resolves.toEqual({ outcome: "deferred", topic: "app/scopes_update", retryDelaySeconds: 240 });
      expect(deps.handled).toEqual([]);
    });

    it("runs a scopes update for an unknown shop on the final attempt so it settles", async () => {
      const deps = scopesDeps(unknown);
      await expect(consumeWebhook(deps, { ...work, attempts: 9 })).resolves.toMatchObject({ outcome: "processed" });
      expect(deps.handled).toEqual(["scopes"]);
    });

    it("a processed delivery stays a duplicate even if the shop is unknown, and compliance never asks for standing", async () => {
      const deps = scopesDeps(unknown);
      const processed = { ...deps, deliveries: { ...deps.deliveries, async get() { return { id: "delivery-1", shop: work.shop, topic: "app/scopes_update", status: "processed", triggeredAt: 50 }; } } };
      await expect(consumeWebhook(processed, work)).resolves.toMatchObject({ outcome: "duplicate" });

      let asked = 0;
      const compliance = { ...dependencies(), shopStanding: async () => { asked += 1; return { tombstoned: true, hasShopRecord: false }; } };
      const redact = { ...compliance, deliveries: { ...compliance.deliveries, async get() { return { id: "delivery-1", shop: work.shop, topic: "shop/redact", status: "queued", triggeredAt: 50 }; } } };
      await expect(consumeWebhook(redact, work)).resolves.toMatchObject({ outcome: "processed" });
      expect(asked).toBe(0);
    });
  });
});
