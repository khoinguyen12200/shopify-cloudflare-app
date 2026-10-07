import { describe, it, expect } from "vitest";
import { computeBillingStats, type BillingProjection } from "./dashboard-stats";

function projection(overrides: Partial<BillingProjection> = {}): BillingProjection {
  return {
    shop: "a.myshopify.com",
    relationshipStatus: "INSTALLED",
    subscriptionStatus: "ACTIVE",
    billingInterval: "EVERY_30_DAYS",
    priceAmount: 1900,
    priceCurrency: "USD",
    ...overrides,
  };
}

describe("computeBillingStats", () => {
  it("counts every shop as free when none has a paid subscription", () => {
    const stats = computeBillingStats([
      projection({ subscriptionStatus: null, priceAmount: null, priceCurrency: null }),
      projection({ shop: "b.myshopify.com", subscriptionStatus: null, priceAmount: null, priceCurrency: null }),
    ]);
    expect(stats).toMatchObject({ totalShops: 2, paidShops: 0, freeShops: 2 });
    expect(stats.mrrByCurrency).toEqual([]);
  });

  it("counts an ACTIVE subscription as paid and includes its price in MRR", () => {
    const stats = computeBillingStats([projection()]);
    expect(stats).toMatchObject({ totalShops: 1, paidShops: 1, freeShops: 0 });
    expect(stats.mrrByCurrency).toEqual([{ amount: 1900, currency: "USD" }]);
  });

  it("excludes an uninstalled paid shop from paid totals and MRR", () => {
    const stats = computeBillingStats([projection({ relationshipStatus: "UNINSTALLED" })]);

    expect(stats).toMatchObject({ paidShops: 0, freeShops: 1, mrrByCurrency: [] });
  });

  it("excludes a deactivated paid shop from paid totals and MRR", () => {
    const stats = computeBillingStats([projection({ relationshipStatus: "DEACTIVATED" })]);
    expect(stats).toMatchObject({ paidShops: 0, freeShops: 1, mrrByCurrency: [] });
  });

  it("counts scheduled cancellation as paid but frozen as free", () => {
    const stats = computeBillingStats([
      projection({ subscriptionStatus: "CANCELLATION_SCHEDULED" }),
      projection({ shop: "frozen.myshopify.com", subscriptionStatus: "FROZEN", priceAmount: 0 }),
    ]);
    expect(stats).toMatchObject({ paidShops: 1, freeShops: 1 });
  });

  it("does not count a canceled subscription as paid", () => {
    const stats = computeBillingStats([projection({ subscriptionStatus: "CANCELED" })]);
    expect(stats).toMatchObject({ paidShops: 0, freeShops: 1 });
    expect(stats.mrrByCurrency).toEqual([]);
  });

  it("converts an annual subscription to its monthly equivalent for MRR", () => {
    const stats = computeBillingStats([projection({ billingInterval: "ANNUAL", priceAmount: 19000 })]);
    // 19000 / 12 = 1583.33... -> rounds to 1583.
    expect(stats.mrrByCurrency).toEqual([{ amount: 1583, currency: "USD" }]);
  });

  it("sums multiple paid shops in the same currency into one MRR figure", () => {
    const stats = computeBillingStats([projection(), projection({ shop: "b.myshopify.com" })]);
    expect(stats.mrrByCurrency).toEqual([{ amount: 3800, currency: "USD" }]);
  });

  it("counts one paid shop once while summing its current pricing items", () => {
    const stats = computeBillingStats([
      projection(),
      projection({ priceAmount: 500 }),
    ]);
    expect(stats).toMatchObject({ totalShops: 1, paidShops: 1, freeShops: 0 });
    expect(stats.mrrByCurrency).toEqual([{ amount: 2400, currency: "USD" }]);
  });

  it("keeps different currencies as separate MRR figures rather than combining them", () => {
    const stats = computeBillingStats([
      projection(),
      projection({ shop: "b.myshopify.com", priceCurrency: "EUR" }),
    ]);
    expect([...stats.mrrByCurrency].sort((a, b) => a.currency.localeCompare(b.currency))).toEqual([
      { amount: 1900, currency: "EUR" },
      { amount: 1900, currency: "USD" },
    ]);
  });

  it("excludes dev stores from real MRR and paid counts while reporting devShops", () => {
    const stats = computeBillingStats([
      projection({ shop: "real-paid.myshopify.com", priceAmount: 2900 }),
      projection({ shop: "real-free.myshopify.com", subscriptionStatus: null, priceAmount: null, priceCurrency: null }),
      projection({ shop: "dev-test.myshopify.com", priceAmount: 7900, isDevStore: true }),
    ]);
    expect(stats).toMatchObject({
      totalShops: 2,
      paidShops: 1,
      freeShops: 1,
      devShops: 1,
    });
    // Dev store's $79.00 must not inflate real MRR: only the real paid store's $29.00 is counted
    expect(stats.mrrByCurrency).toEqual([{ amount: 2900, currency: "USD" }]);
  });

  it("counts stores by plan correctly across free and paid tiers", () => {
    const stats = computeBillingStats([
      projection({ shop: "pro-1.myshopify.com", planHandle: "pro", subscriptionStatus: "ACTIVE" }),
      projection({ shop: "pro-2.myshopify.com", planHandle: "pro", subscriptionStatus: "ACTIVE" }),
      projection({ shop: "free-1.myshopify.com", subscriptionStatus: null, priceAmount: null, priceCurrency: null }),
      projection({ shop: "free-2.myshopify.com", subscriptionStatus: "CANCELED", priceAmount: null, priceCurrency: null }),
    ]);

    expect(stats.totalShops).toBe(4);
    expect(stats.paidShops).toBe(2);
    expect(stats.freeShops).toBe(2);
    expect(stats.shopsByPlan).toEqual({
      free: 2,
      pro: 2,
    });
  });

  it("handles multi-item subscriptions without double-counting the shop in shopsByPlan", () => {
    const stats = computeBillingStats([
      projection({ shop: "pro-multi.myshopify.com", planHandle: "pro", priceAmount: 1900 }),
      projection({ shop: "pro-multi.myshopify.com", planHandle: "pro", priceAmount: 500 }),
      projection({ shop: "free-single.myshopify.com", subscriptionStatus: null, priceAmount: null, priceCurrency: null }),
    ]);

    expect(stats.totalShops).toBe(2);
    expect(stats.paidShops).toBe(1);
    expect(stats.freeShops).toBe(1);
    expect(stats.shopsByPlan).toEqual({
      free: 1,
      pro: 1,
    });
  });
});
