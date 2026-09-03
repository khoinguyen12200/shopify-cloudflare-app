import { describe, expect, it } from "vitest";
import {
  ingestWebhook,
  type WebhookIngestDependencies,
} from "./webhook-ingest";

function dependencies(): WebhookIngestDependencies & { readonly queued: string[] } {
  const queued: string[] = [];
  return {
    deliveries: {
      async claim() {
        return "claimed" as const;
      },
      async get() { return undefined; },
      async markQueued() {},
    },
    queue: { async send(message) { queued.push(`${message.shop}:${message.id}`); } },
    hashPayload: async () => "a".repeat(64),
    queued,
  };
}

describe("ingestWebhook", () => {
  it("retries received delivery through injected port", async () => {
    const calls: string[] = [];
    const deps = dependencies();
    const deliveries = {
      ...deps.deliveries,
      async claim() { calls.push("claim"); return "duplicate" as const; },
      async get() { calls.push("get"); return { status: "received" }; },
      async markQueued() { calls.push("queued"); },
    };
    const result = await ingestWebhook({ ...deps, deliveries }, { webhookId: "id", eventId: "event", topic: "topic", shop: "shop.myshopify.com", apiVersion: "2026-10", triggeredAt: 1, receivedAt: 2, payload: {} });
    expect({ result, calls }).toEqual({ result: "queued", calls: ["claim", "get", "queued"] });
  });

  it("claims, hashes, and queues an authenticated delivery", async () => {
    const deps = dependencies();

    const result = await ingestWebhook(deps, {
      webhookId: "delivery-1",
      eventId: "event-1",
      topic: "app/uninstalled",
      shop: "example.myshopify.com",
      apiVersion: "2026-10",
      triggeredAt: 100,
      receivedAt: 200,
      payload: { shop_id: 1 },
    });

    expect(result).toBe("queued");
    expect(deps.queued).toEqual(["example.myshopify.com:delivery-1"]);
  });

  it("normalizes Shopify enum webhook topics for the consumer registry", async () => {
    const claimed: string[] = [];
    const deps = dependencies();
    const deliveries = {
      ...deps.deliveries,
      async claim(input: { topic: string }) {
        claimed.push(input.topic);
        return "claimed" as const;
      },
    };

    await ingestWebhook({ ...deps, deliveries }, {
      webhookId: "delivery-uninstall",
      eventId: "event-uninstall",
      topic: "APP_UNINSTALLED",
      shop: "example.myshopify.com",
      apiVersion: "2026-10",
      triggeredAt: 100,
      receivedAt: 200,
      payload: {},
    });

    expect(claimed).toEqual(["app/uninstalled"]);
  });

  it("persists typed payload values before queue handoff", async () => {
    const deps = dependencies();
    const calls: string[] = [];

    await ingestWebhook({ ...deps, beforeEnqueue: async () => { calls.push("stored"); } }, {
      webhookId: "delivery-1", eventId: "event-1", topic: "app/scopes_update",
      shop: "example.myshopify.com", apiVersion: "2026-10", triggeredAt: 100,
      receivedAt: 200, payload: { current: ["read_products"] },
    });

    expect(calls).toEqual(["stored"]);
  });

  it("does not queue a duplicate Shopify webhook ID", async () => {
    const deps = dependencies();
    const deliveries = {
      ...deps.deliveries,
      async claim() {
        return "duplicate" as const;
      },
    };

    const result = await ingestWebhook({ ...deps, deliveries }, {
      webhookId: "delivery-1",
      eventId: "event-1",
      topic: "app/uninstalled",
      shop: "example.myshopify.com",
      apiVersion: "2026-10",
      triggeredAt: 100,
      receivedAt: 200,
      payload: {},
    });

    expect(result).toBe("duplicate");
    expect(deps.queued).toEqual([]);
  });

  it("retries queue handoff for a delivery left received by an earlier failure", async () => {
    const deps = dependencies();
    const deliveries = {
      ...deps.deliveries,
      async claim() { return "duplicate" as const; },
      async get() { return { status: "received" as const }; },
    };

    const result = await ingestWebhook({ ...deps, deliveries }, {
      webhookId: "delivery-1", eventId: "event-1", topic: "app/uninstalled",
      shop: "example.myshopify.com", apiVersion: "2026-10", triggeredAt: 100,
      receivedAt: 200, payload: {},
    });

    expect(result).toBe("queued");
    expect(deps.queued).toEqual(["example.myshopify.com:delivery-1"]);
  });
});
