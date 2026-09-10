import { eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
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
  it("preserves newer subscription items when an older event arrives", async () => {
    await inRequest(async () => {
      const repo = new ShopifyEventRepo();
      const base = { shop: "stale-items", shopifyShopId: "gid", subscriptionId: "sub", synchronizedAt: 1, status: "ACTIVE" as const, type: "UPDATED" as const };
      await repo.recordPartnerSubscription({ ...base, id: "new", occurredAt: 2, items: [{ itemType: "new" }] });
      await repo.recordPartnerSubscription({ ...base, id: "old", occurredAt: 1, items: [{ itemType: "old" }] });
      const rows = await makeDb(env.DB).select({ item_type: schema.shopSubscriptionItems.itemType }).from(schema.shopSubscriptionItems).where(eq(schema.shopSubscriptionItems.shop, base.shop)).all().then((results) => ({ results }));
      expect(rows.results).toEqual([{ item_type: "new" }]);
    });
  });
  it("updates subscription metadata on newer lifecycle events", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopifyEventRepo();
      const base = { shop: "metadata-ledger.myshopify.com", shopifyShopId: "gid://shopify/Shop/9", subscriptionId: "sub-9", synchronizedAt: 1, status: "ACTIVE" as const };
      await repo.recordPartnerSubscription({ ...base, id: "evt-1", type: "CREATED", occurredAt: 1, planHandle: "basic", billingInterval: "MONTH", trialEndsAt: 10, cancellationEffectiveAt: null });
      await repo.recordPartnerSubscription({ ...base, id: "evt-2", type: "UPDATED", occurredAt: 2, planHandle: "pro", billingInterval: "YEAR", trialEndsAt: 20, cancellationEffectiveAt: 30 });
      return makeDb(env.DB).select({ plan: schema.shopSubscriptions.planHandle, interval: schema.shopSubscriptions.billingInterval, trial: schema.shopSubscriptions.trialEndsAt, cancel: schema.shopSubscriptions.cancellationEffectiveAt }).from(schema.shopSubscriptions).where(eq(schema.shopSubscriptions.shop, base.shop)).get();
    });
    expect(row).toMatchObject({ plan: "pro", interval: "YEAR", trial: 20, cancel: 30 });
  });
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
