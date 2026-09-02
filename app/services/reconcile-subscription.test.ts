import { describe, expect, it } from "vitest";
import { refreshSubscription, type SubscriptionProjectionPort } from "./reconcile-subscription";
import type { ShopifyPartnerPort } from "~/ports/shopify-partner";

describe("refreshSubscription", () => {
  it("makes one authoritative Partner read and replaces current projection", async () => {
    let calls = 0;
    let observation: unknown;
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => {
        calls += 1;
        return { shop: null, billingPeriod: null, cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null, legacySubscriptionId: "sub-1", items: [{ handle: "pro", description: null, price: { kind: "flat", amount: "29.00", currency: "USD" }, cappedAmount: null }], pendingUpdate: null };
      },
    };
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; return "applied"; } };
    await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100)).resolves.toMatchObject({ status: "refreshed" });
    expect(calls).toBe(1);
    expect(observation).toMatchObject({ type: "ACTIVE_SUBSCRIPTION", subscriptionId: "sub-1", status: "ACTIVE", planHandle: "pro", occurredAt: 100 });
  });

  it("projects null response as NONE, but missing credentials as failure", async () => {
    let observation: unknown;
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; return "applied"; } };
    const partner: ShopifyPartnerPort = { listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }), activeSubscription: async () => null };
    await refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100);
    expect(observation).toMatchObject({ type: "ACTIVE_SUBSCRIPTION", status: "NONE" });
    await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: null }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100)).resolves.toMatchObject({ status: "failed" });
  });

  it("uses Shopify legacy subscription ID instead of a synthetic shared ID", async () => {
    let observation: unknown;
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; return "applied"; } };
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => ({ shop: null, billingPeriod: "EVERY_30_DAYS", cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null, legacySubscriptionId: "gid://shopify/AppSubscription/7", items: [], pendingUpdate: null }),
    };
    await refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100);
    expect(observation).toMatchObject({ subscriptionId: "gid://shopify/AppSubscription/7", externalId: "gid://shopify/AppSubscription/7" });
  });

  it("uses shop identity for native managed pricing subscriptions", async () => {
    let observation: unknown;
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; return "applied"; } };
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => ({ shop: null, billingPeriod: null, cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null, legacySubscriptionId: null, items: [], pendingUpdate: null }),
    };
    await refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100);
    expect(observation).toMatchObject({ status: "ACTIVE", subscriptionId: "active:gid://shopify/Shop/1" });
  });

  it("converts Partner decimal prices to integer minor units", async () => {
    let observation: unknown;
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; return "applied"; } };
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => ({ shop: null, billingPeriod: "EVERY_30_DAYS", cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null, legacySubscriptionId: null, items: [{ handle: "pro", description: "Pro", price: { kind: "flat", amount: "29.00", currency: "USD", tiers: [] }, cappedAmount: null }], pendingUpdate: null }),
    };
    await refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100);
    expect(observation).toMatchObject({ items: [{ itemType: "pro", priceAmount: 2900, priceCurrency: "USD" }] });
  });

  it("projects schema-realistic cancellation, cycle, trial, pending plan, and item money", async () => {
    let observation: unknown;
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async (_shop, value) => { observation = value; return "applied"; } };
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => ({
        shop: null,
        billingPeriod: "EVERY_30_DAYS",
        cancelAtEndOfCycle: true,
        trialEndsAt: "2026-04-15T00:00:00Z",
        currentBillingCycle: { startTime: "2026-04-01T00:00:00Z", endTime: "2026-05-01T00:00:00Z" },
        legacySubscriptionId: "gid://shopify/AppSubscription/7",
        items: [{ handle: "pro", description: "Pro", price: { kind: "flat", amount: "29.00", currency: "USD", tiers: [] }, cappedAmount: null }],
        pendingUpdate: { billingPeriod: "ANNUAL", legacySubscriptionId: "gid://shopify/AppSubscription/8", items: [{ handle: "plus", description: "Plus", price: { kind: "flat", amount: "299.00", currency: "USD", tiers: [] }, cappedAmount: null }] },
      }),
    };

    await refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100);

    expect(observation).toMatchObject({
      status: "CANCELLATION_SCHEDULED",
      planHandle: "pro",
      trialEndsAt: Date.parse("2026-04-15T00:00:00Z"),
      currentPeriodStartsAt: Date.parse("2026-04-01T00:00:00Z"),
      currentPeriodEndsAt: Date.parse("2026-05-01T00:00:00Z"),
      cancellationEffectiveAt: Date.parse("2026-05-01T00:00:00Z"),
      pendingPlanHandle: "plus",
      pendingBillingInterval: "ANNUAL",
      pendingLegacySubscriptionId: "gid://shopify/AppSubscription/8",
      items: [{ itemType: "pro", priceAmount: 2900, priceCurrency: "USD" }],
    });
  });

  it("fails refresh for malformed flat pricing", async () => {
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async () => "applied" };
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => ({
        shop: null, billingPeriod: "EVERY_30_DAYS", cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null, legacySubscriptionId: null,
        items: [{ handle: "usage", description: "Usage", price: { kind: "flat", amount: null, currency: "USD" }, cappedAmount: null }], pendingUpdate: null,
      }),
    };
    await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100)).resolves.toMatchObject({ status: "failed", code: "SUBSCRIPTION_REFRESH_FAILED" });
  });

  it("fails refresh explicitly for malformed or tiered Partner pricing", async () => {
    const subscriptions: SubscriptionProjectionPort = { upsertSubscriptionProjection: async () => "applied" };
    const partner: ShopifyPartnerPort = {
      listHistoricalEvents: async () => ({ events: [], hasNextPage: false, endCursor: null }),
      activeSubscription: async () => ({
        shop: null, billingPeriod: "EVERY_30_DAYS", cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null, legacySubscriptionId: "sub-bad",
        items: [{ handle: "usage", description: "Usage", price: { kind: "tiered", amount: null, currency: "USD", tiers: [{ upTo: "10", amountPerUnit: "1.00", amount: "10.00" }] }, cappedAmount: null }], pendingUpdate: null,
      }),
    };
    await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => 100 }, appId: "app" }, { shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1" }, 100)).resolves.toMatchObject({ status: "failed", code: "SUBSCRIPTION_REFRESH_FAILED" });
  });
});
