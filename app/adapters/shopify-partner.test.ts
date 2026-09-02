import { describe, expect, it } from "vitest";
import { ShopifyPartnerAdapter } from "./shopify-partner.server";

describe("ShopifyPartnerAdapter", () => {
  it("reads active subscription through Partner GraphQL", async () => {
    const calls: Request[] = [];
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      organizationId: "org-123",
      apiVersion: "2026-07",
      fetch: async (input, init) => {
        calls.push(new Request(input, init));
        return new Response(JSON.stringify({ data: { activeSubscription: null } }), { status: 200 });
      },
    });

    await expect(adapter.activeSubscription("app", "shop")).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://partners.shopify.com/org-123/api/2026-07/graphql.json");
    expect(calls[0]?.headers.get("X-Shopify-Access-Token")).toBe("token");
  });

  it("normalizes complete active subscription pricing and cycle fields", async () => {
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      organizationId: "org-123",
      apiVersion: "2026-07",
      fetch: async () => new Response(JSON.stringify({ data: { activeSubscription: {
        legacySubscriptionId: "gid://shopify/AppSubscription/9", billingPeriod: "EVERY_30_DAYS", cancelAtEndOfCycle: true,
        trialEndsAt: "2026-05-01T00:00:00Z", currentBillingCycle: { startTime: "2026-04-01T00:00:00Z", endTime: "2026-05-01T00:00:00Z" },
        items: [{ handle: "pro", description: "Pro", price: { __typename: "FlatRatePrice", active: true, currency: "USD", amount: "29.00" }, discount: null, usage: null }], pendingUpdate: null,
      } } })),
    });
    await expect(adapter.activeSubscription("app", "shop")).resolves.toMatchObject({
      legacySubscriptionId: "gid://shopify/AppSubscription/9",
      cancelAtEndOfCycle: true,
      trialEndsAt: "2026-05-01T00:00:00Z",
      currentBillingCycle: { startTime: "2026-04-01T00:00:00Z", endTime: "2026-05-01T00:00:00Z" },
      items: [{ handle: "pro", price: { kind: "flat", amount: "29.00", currency: "USD" } }],
    });
  });

  it("returns typed historical events and pagination state", async () => {
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      organizationId: "org-123",
      apiVersion: "2026-07",
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
      organizationId: "org-123",
      apiVersion: "2026-07",
      fetch: async () => new Response(JSON.stringify({ errors: [{ message: "denied" }] }), { status: 200 }),
    });

    await expect(adapter.listHistoricalEvents({ appId: "app" })).rejects.toThrow("denied");
  });

  it("rejects missing endpoint config before making a request", async () => {
    let calls = 0;
    const adapter = new ShopifyPartnerAdapter({ token: "", organizationId: "", apiVersion: "", fetch: async () => { calls += 1; return new Response(); } });
    await expect(adapter.activeSubscription("app", "shop")).rejects.toThrow("organization, version, and token");
    expect(calls).toBe(0);
  });
});
