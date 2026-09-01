import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import {
  ShopifyEventRepo,
  type PartnerRelationshipEvent,
} from "./shopify-events.server";

setupTestDatabase();

function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

function relationshipEvent(
  overrides: Partial<PartnerRelationshipEvent> = {},
): PartnerRelationshipEvent {
  return {
    id: "partner-event-1",
    shop: "events.myshopify.com",
    shopifyShopId: "gid://shopify/Shop/1",
    type: "INSTALLED",
    occurredAt: 1_700_000_000_000,
    synchronizedAt: 1_700_000_000_100,
    reason: "MERCHANT_INSTALL",
    reasonDescription: "The merchant installed the app.",
    ...overrides,
  };
}

describe("ShopifyEventRepo", () => {
  it("records a Partner event ID exactly once", async () => {
    const result = await inRequest(async () => {
      const repo = new ShopifyEventRepo();
      const event = relationshipEvent();
      return [await repo.recordPartnerEvent(event), await repo.recordPartnerEvent(event)];
    });

    expect(result).toEqual(["inserted", "duplicate"]);
  });

  it("stores relationship details in their typed relational record", async () => {
    const history = await inRequest(async () => {
      const repo = new ShopifyEventRepo();
      await repo.recordPartnerEvent(relationshipEvent());
      return repo.listRelationshipEvents("events.myshopify.com");
    });

    expect(history).toEqual([
      expect.objectContaining({
        eventId: "partner-event-1",
        eventType: "INSTALLED",
        reason: "MERCHANT_INSTALL",
        reasonDescription: "The merchant installed the app.",
      }),
    ]);
  });

  it("does not expose a shop's event history to another shop", async () => {
    const history = await inRequest(async () => {
      const repo = new ShopifyEventRepo();
      await repo.recordPartnerEvent(relationshipEvent());
      return repo.listRelationshipEvents("other.myshopify.com");
    });

    expect(history).toEqual([]);
  });
});
