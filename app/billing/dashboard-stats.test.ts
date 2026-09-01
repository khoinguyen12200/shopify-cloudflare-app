import { describe, it, expect } from "vitest";
import { computeBillingStats } from "./dashboard-stats";
import type { Shop, SubscriptionEvent } from "~/db/schema";

function shop(overrides: Partial<Shop> = {}): Shop {
  return {
    shop: "a.myshopify.com",
    shopifyShopId: null,
    relationshipStatus: null,
    relationshipOccurredAt: null,
    relationshipExternalId: null,
    installedAt: 1,
    currentInstalledAt: null,
    uninstalledAt: null,
    lastAuthenticatedAt: null,
    lastWebhookAt: null,
    lastReconciledAt: null,
    ...overrides,
  };
}

function event(overrides: Partial<SubscriptionEvent> = {}): SubscriptionEvent {
  return {
    id: "evt",
    shop: "a.myshopify.com",
    subscriptionId: "gid://shopify/AppSubscription/1",
    name: "TODO:PRO",
    status: "ACTIVE",
    planHandle: "todo-pro",
    interval: "every_30_days",
    priceAmount: 1900,
    priceCurrency: "USD",
    cappedAmountAmount: null,
    cappedAmountCurrency: null,
    shopifyCreatedAt: 1,
    shopifyUpdatedAt: 1,
    receivedAt: 1,
    ...overrides,
  };
}

describe("computeBillingStats", () => {
  it("counts every shop as free when none has a paid subscription", () => {
    const stats = computeBillingStats([shop(), shop({ shop: "b.myshopify.com" })], new Map());
    expect(stats).toMatchObject({ totalShops: 2, paidShops: 0, freeShops: 2 });
    expect(stats.mrrByCurrency).toEqual([]);
  });

  it("counts an ACTIVE subscription as paid and includes its price in MRR", () => {
    const latest = new Map([["a.myshopify.com", event()]]);
    const stats = computeBillingStats([shop()], latest);
    expect(stats).toMatchObject({ totalShops: 1, paidShops: 1, freeShops: 0 });
    expect(stats.mrrByCurrency).toEqual([{ amount: 1900, currency: "USD" }]);
  });

  it("excludes an uninstalled paid shop from paid totals and MRR", () => {
    const latest = new Map([["a.myshopify.com", event()]]);
    const stats = computeBillingStats([shop({ uninstalledAt: 2 })], latest);

    expect(stats).toMatchObject({ paidShops: 0, freeShops: 1, mrrByCurrency: [] });
  });

  it("does not count a CANCELLED subscription as paid", () => {
    const latest = new Map([["a.myshopify.com", event({ status: "CANCELLED" })]]);
    const stats = computeBillingStats([shop()], latest);
    expect(stats).toMatchObject({ paidShops: 0, freeShops: 1 });
    expect(stats.mrrByCurrency).toEqual([]);
  });

  it("converts an annual subscription to its monthly equivalent for MRR", () => {
    const latest = new Map([
      ["a.myshopify.com", event({ interval: "annual", priceAmount: 19000 })],
    ]);
    const stats = computeBillingStats([shop()], latest);
    // 19000 / 12 = 1583.33... -> rounds to 1583.
    expect(stats.mrrByCurrency).toEqual([{ amount: 1583, currency: "USD" }]);
  });

  it("sums multiple paid shops in the same currency into one MRR figure", () => {
    const latest = new Map([
      ["a.myshopify.com", event()],
      ["b.myshopify.com", event({ shop: "b.myshopify.com" })],
    ]);
    const stats = computeBillingStats(
      [shop(), shop({ shop: "b.myshopify.com" })],
      latest,
    );
    expect(stats.mrrByCurrency).toEqual([{ amount: 3800, currency: "USD" }]);
  });

  it("keeps different currencies as separate MRR figures rather than combining them", () => {
    const latest = new Map([
      ["a.myshopify.com", event()],
      ["b.myshopify.com", event({ shop: "b.myshopify.com", priceCurrency: "EUR" })],
    ]);
    const stats = computeBillingStats(
      [shop(), shop({ shop: "b.myshopify.com" })],
      latest,
    );
    expect([...stats.mrrByCurrency].sort((a, b) => a.currency.localeCompare(b.currency))).toEqual([
      { amount: 1900, currency: "EUR" },
      { amount: 1900, currency: "USD" },
    ]);
  });
});
