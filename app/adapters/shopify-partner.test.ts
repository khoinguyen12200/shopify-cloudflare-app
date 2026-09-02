import { describe, expect, it } from "vitest";
import { ShopifyPartnerAdapter } from "./shopify-partner.server";

describe("ShopifyPartnerAdapter", () => {
  it("reads active subscription through Partner GraphQL", async () => {
    const calls: Request[] = [];
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      fetch: async (input, init) => {
        calls.push(new Request(input, init));
        return new Response(JSON.stringify({ data: { activeSubscription: null } }), { status: 200 });
      },
    });

    await expect(adapter.activeSubscription("app", "shop")).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get("X-Shopify-Access-Token")).toBe("token");
  });

  it("normalizes complete active subscription pricing data", async () => {
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      fetch: async () => new Response(JSON.stringify({ data: { activeSubscription: {
        legacySubscriptionId: "gid://shopify/AppSubscription/legacy-1",
        billingPeriod: "EVERY_30_DAYS",
        trialEndsAt: "2026-02-01T00:00:00Z",
        currentBillingCycle: { startTime: "2026-01-01T00:00:00Z", endTime: "2026-02-01T00:00:00Z" },
        items: [{ handle: "pro", price: { amount: "29.99", currency: "USD" }, discount: { amount: "5.00", discountEndsAt: "2026-02-01T00:00:00Z" }, usage: { cost: { amount: "2.50", currencyCode: "USD" } } }],
        pendingUpdate: { billingPeriod: "EVERY_30_DAYS" },
      } } }), { status: 200 }),
    });

    await expect(adapter.activeSubscription("app", "shop")).resolves.toMatchObject({
      legacySubscriptionId: "gid://shopify/AppSubscription/legacy-1",
      pricingItems: [{ handle: "pro", priceAmount: "29.99", priceCurrency: "USD", cappedAmount: null, cappedCurrency: null }],
      discounts: [{ amount: "5.00", currency: "USD", duration: "2026-02-01T00:00:00Z" }],
      usage: { billedAmount: "2.50", billedCurrency: "USD" },
      pendingUpdate: { status: "PENDING", effectiveAt: null },
    });
  });

  it("returns typed historical events and pagination state", async () => {
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      fetch: async () => new Response(JSON.stringify({ data: { events: {
        edges: [{ node: {
          id: "evt-1",
          eventType: "RELATIONSHIP_INSTALLED",
          occurredAt: "2026-01-01T00:00:00Z",
          shop: { id: "gid://shopify/Shop/1", myshopifyDomain: "example.myshopify.com" },
          state: "INSTALLED",
        } }],
        pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
      } } }), { status: 200 }),
    });

    await expect(adapter.listHistoricalEvents({ appId: "app" })).resolves.toEqual({
      events: [{
        kind: "relationship",
        id: "evt-1",
        occurredAt: "2026-01-01T00:00:00Z",
        shop: "example.myshopify.com",
        shopId: "gid://shopify/Shop/1",
        type: "INSTALLED",
      }],
      hasNextPage: true,
      endCursor: "cursor-1",
    });
  });

  it("rejects Partner GraphQL errors", async () => {
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      fetch: async () => new Response(JSON.stringify({ errors: [{ message: "denied" }] }), { status: 200 }),
    });

    await expect(adapter.listHistoricalEvents({ appId: "app" })).rejects.toThrow("denied");
  });
});
