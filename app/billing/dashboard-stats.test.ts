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
});
