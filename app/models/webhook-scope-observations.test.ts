import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { WebhookScopeObservationRepo } from "./webhook-scope-observations.server";
import { WebhookDeliveryRepo } from "./webhook-deliveries.server";

setupTestDatabase();

describe("WebhookScopeObservationRepo", () => {
  it("stores normalized scope values for one delivery without retaining a payload blob", async () => {
    const scopes = await runWithRequestContext(env, async () => {
      await new WebhookDeliveryRepo().claim({
        id: "delivery-1", eventId: "event-1", topic: "app/scopes_update",
        apiVersion: "2026-10", shop: "example.myshopify.com", triggeredAt: 1,
        receivedAt: 1, payloadHash: "a".repeat(64),
      });
      const repo = new WebhookScopeObservationRepo();
      await repo.record("delivery-1", "example.myshopify.com", ["write_products", "read_products"]);
      return repo.list("delivery-1", "example.myshopify.com");
    });

    expect(scopes).toEqual(["read_products", "write_products"]);
  });
});
