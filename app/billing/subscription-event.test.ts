import { describe, it, expect } from "vitest";
import { parseSubscriptionUpdatePayload, storedEventPrice } from "./subscription-event";

const VALID_PAYLOAD = {
  app_subscription: {
    admin_graphql_api_id: "gid://shopify/AppSubscription/1029266977",
    name: "TODO:PRO",
    status: "ACTIVE",
    admin_graphql_api_shop_id: "gid://shopify/Shop/548380009",
    created_at: "2024-06-25T00:00:00.000Z",
    updated_at: "2024-06-25T00:00:00.000Z",
    currency: "USD",
    capped_amount: "20.0",
    price: "19.00",
    interval: "every_30_days",
    plan_handle: "plan-123",
  },
};

describe("parseSubscriptionUpdatePayload", () => {
  it("parses a complete, valid payload", () => {
    const result = parseSubscriptionUpdatePayload(VALID_PAYLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      subscriptionId: "gid://shopify/AppSubscription/1029266977",
      name: "TODO:PRO",
      status: "ACTIVE",
      planHandle: "plan-123",
      interval: "every_30_days",
      price: { amount: 1900, currency: "USD" },
      cappedAmount: { amount: 2000, currency: "USD" },
    });
    expect(result.value.shopifyCreatedAt).toBe(Date.parse("2024-06-25T00:00:00.000Z"));
    expect(result.value.shopifyUpdatedAt).toBe(Date.parse("2024-06-25T00:00:00.000Z"));
  });

  it("treats a missing plan_handle, interval, and capped_amount as absent, not an error", () => {
    const { capped_amount, plan_handle, interval, ...rest } = VALID_PAYLOAD.app_subscription;
    const result = parseSubscriptionUpdatePayload({ app_subscription: rest });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.planHandle).toBeNull();
    expect(result.value.interval).toBeNull();
    expect(result.value.cappedAmount).toBeNull();
  });

  it("rejects a status Shopify has never documented", () => {
    const result = parseSubscriptionUpdatePayload({
      app_subscription: { ...VALID_PAYLOAD.app_subscription, status: "SOMETHING_NEW" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed price rather than silently zeroing it", () => {
    const result = parseSubscriptionUpdatePayload({
      app_subscription: { ...VALID_PAYLOAD.app_subscription, price: "not-a-number" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a payload missing the app_subscription envelope", () => {
    const result = parseSubscriptionUpdatePayload({});
    expect(result.ok).toBe(false);
  });
});

describe("storedEventPrice", () => {
  it("rebuilds a Money from a stored row's minor-units columns", () => {
    const money = storedEventPrice({ priceAmount: 1900, priceCurrency: "USD" });
    expect(money).toEqual({ amount: 1900, currency: "USD" });
  });
});
