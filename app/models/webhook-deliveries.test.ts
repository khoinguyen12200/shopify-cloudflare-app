import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import {
  WebhookDeliveryRepo,
  type WebhookDeliveryInput,
} from "./webhook-deliveries.server";

setupTestDatabase();

function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

function delivery(overrides: Partial<WebhookDeliveryInput> = {}): WebhookDeliveryInput {
  return {
    id: "delivery-1",
    eventId: "event-1",
    topic: "app/uninstalled",
    apiVersion: "2026-10",
    shop: "delivery.myshopify.com",
    triggeredAt: 1_700_000_000_000,
    receivedAt: 1_700_000_000_100,
    payloadHash: "a".repeat(64),
    ...overrides,
  };
}

describe("WebhookDeliveryRepo", () => {
  it("claims one webhook delivery ID exactly once", async () => {
    const result = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      return [await repo.claim(input), await repo.claim(input)];
    });

    expect(result).toEqual(["claimed", "duplicate"]);
  });

  it("treats a different delivery ID as a separate transport attempt", async () => {
    const result = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      await repo.claim(delivery());
      return repo.claim(delivery({ id: "delivery-2" }));
    });

    expect(result).toBe("claimed");
  });

  it("records processing and a bounded failed-delivery outcome", async () => {
    const stored = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markProcessing(input.shop, input.id, 1_700_000_000_200, "received", null);
      await repo.markFailed(input.shop, input.id, {
        failedAt: 1_700_000_000_300,
        failureCode: "invalid_payload",
        failureDetail: "The event does not contain a shop ID.",
      }, "processing", 1_700_000_000_200);
      return repo.get(input.shop, input.id);
    });

    expect(stored).toMatchObject({
      id: "delivery-1",
      status: "failed",
      attempts: 1,
      processingStartedAt: 1_700_000_000_200,
      failedAt: 1_700_000_000_300,
      failureCode: "invalid_payload",
      failureDetail: "The event does not contain a shop ID.",
    });
  });

  it("records a processed-delivery outcome", async () => {
    const stored = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markProcessing(input.shop, input.id, 1_700_000_000_200, "received", null);
      await repo.markProcessed(input.shop, input.id, 1_700_000_000_300, "processing", 1_700_000_000_200);
      return repo.get(input.shop, input.id);
    });

    expect(stored).toMatchObject({
      status: "processed",
      attempts: 1,
      processedAt: 1_700_000_000_300,
    });
  });

  it("marks a claimed delivery as queued before a worker handles it", async () => {
    const stored = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markQueued(input.shop, input.id);
      return repo.get(input.shop, input.id);
    });

    expect(stored).toMatchObject({ status: "queued" });
  });

  it("grants processing to only one worker", async () => {
    const claims = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      return [
        await repo.markProcessing(input.shop, input.id, 1_700_000_000_200, "received", null),
        await repo.markProcessing(input.shop, input.id, 1_700_000_000_201, "received", null),
      ];
    });

    expect(claims).toEqual(["applied", "conflict"]);
  });

  it("does not reclaim a processed delivery", async () => {
    const result = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markProcessing(input.shop, input.id, 1_700_000_000_200, "received", null);
      await repo.markProcessed(input.shop, input.id, 1_700_000_000_300, "processing", 1_700_000_000_200);
      const retry = await repo.markProcessing(input.shop, input.id, 1_700_000_000_400, "processing", 1_700_000_000_200);
      return { retry, stored: await repo.get(input.shop, input.id) };
    });

    expect(result).toEqual({
      retry: "conflict",
      stored: expect.objectContaining({
        status: "processed",
        attempts: 1,
        processedAt: 1_700_000_000_300,
      }),
    });
  });

  it("persists a service-approved processing lease reclaim", async () => {
    const claims = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markProcessing(input.shop, input.id, 1_700_000_000_000, "received", null);
      return repo.markProcessing(input.shop, input.id, 1_700_000_300_001, "processing", 1_700_000_000_000);
    });

    expect(claims).toBe("applied");
  });

  it("does not let a stale failure overwrite a processed delivery", async () => {
    const stored = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markProcessing(input.shop, input.id, 1_700_000_000_200, "received", null);
      await repo.markProcessed(input.shop, input.id, 1_700_000_000_300, "processing", 1_700_000_000_200);
      await repo.markFailed(input.shop, input.id, {
        failedAt: 1_700_000_000_400,
        failureCode: "late_failure",
        failureDetail: "A stale worker completed after the successful worker.",
      }, "processing", 1_700_000_000_200);
      return repo.get(input.shop, input.id);
    });

    expect(stored).toMatchObject({
      status: "processed",
      processedAt: 1_700_000_000_300,
      failedAt: null,
      failureCode: null,
      failureDetail: null,
    });
  });

  it("does not let a stale success overwrite a failed delivery", async () => {
    const stored = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      const input = delivery();
      await repo.claim(input);
      await repo.markProcessing(input.shop, input.id, 1_700_000_000_200, "received", null);
      await repo.markFailed(input.shop, input.id, {
        failedAt: 1_700_000_000_300,
        failureCode: "processing_error",
        failureDetail: "The worker failed while processing the delivery.",
      }, "processing", 1_700_000_000_200);
      await repo.markProcessed(input.shop, input.id, 1_700_000_000_400, "processing", 1_700_000_000_200);
      return repo.get(input.shop, input.id);
    });

    expect(stored).toMatchObject({
      status: "failed",
      processedAt: null,
      failedAt: 1_700_000_000_300,
      failureCode: "processing_error",
    });
  });

  it("does not expose a delivery through another shop's scope", async () => {
    const found = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      await repo.claim(delivery());
      return repo.get("other.myshopify.com", "delivery-1");
    });

    expect(found).toBeUndefined();
  });

  it("lists every delivery for a shop in newest-first order", async () => {
    const rows = await inRequest(async () => {
      const repo = new WebhookDeliveryRepo();
      await repo.claim(delivery({ id: "delivery-old", receivedAt: 100 }));
      await repo.claim(delivery({ id: "delivery-new", receivedAt: 200 }));
      return repo.listForShop("delivery.myshopify.com");
    });

    expect(rows.map((row) => row.id)).toEqual(["delivery-new", "delivery-old"]);
  });
});
