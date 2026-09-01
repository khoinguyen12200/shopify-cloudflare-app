import { describe, expect, it } from "vitest";
import { refreshSubscription, type SubscriptionProjectionPort } from "./reconcile-subscription";
import type { ShopifyPartnerPort } from "~/ports/shopify-partner";

describe("refreshSubscription", () => {
  it("makes one authoritative Partner read and replaces current projection", async () => {
    let calls = 0;
    let observation: unknown;
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => { calls += 1; return { id: "sub-1", status: "ACTIVE", planHandle: "pro" }; },
    };
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; } };
    await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100)).resolves.toMatchObject({ status: "refreshed" });
    expect(calls).toBe(1);
    expect(observation).toMatchObject({ type: "ACTIVE_SUBSCRIPTION", subscriptionId: "sub-1", status: "ACTIVE", planHandle: "pro", occurredAt: 100 });
  });

  it("projects null response as NONE, but missing credentials as failure", async () => {
    let observation: unknown;
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; } };
    const partner: ShopifyPartnerPort = { listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }), activeSubscription: async () => null };
    await refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100);
    expect(observation).toMatchObject({ type: "ACTIVE_SUBSCRIPTION", status: "NONE" });
    await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: null }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100)).resolves.toMatchObject({ status: "failed" });
  });
});
