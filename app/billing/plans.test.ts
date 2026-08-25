import { describe, it, expect } from "vitest";
import {
  cheapestPaidPlanKey,
  FEATURED_PLAN_KEY,
  PLANS,
  planForShopifyHandle,
  priceFor,
} from "./plans";

describe("PLANS", () => {
  it("has exactly the free and pro rows", () => {
    expect(Object.keys(PLANS).sort()).toEqual(["free", "pro"]);
  });

  it("prices the free plan at zero, monthly and annual", () => {
    expect(PLANS.free.priceMonthly.amount).toBe(0);
    expect(PLANS.free.priceAnnual.amount).toBe(0);
  });

  it("gives the pro plan a positive monthly and annual price", () => {
    expect(PLANS.pro.priceMonthly.amount).toBeGreaterThan(0);
    expect(PLANS.pro.priceAnnual.amount).toBeGreaterThan(0);
  });

  it("prices the pro plan's annual option cheaper than paying monthly all year", () => {
    expect(PLANS.pro.priceAnnual.amount).toBeLessThan(PLANS.pro.priceMonthly.amount * 12);
  });

  it("names every plan with an unmistakable TODO placeholder", () => {
    expect(PLANS.free.name).toMatch(/^TODO:/);
    expect(PLANS.pro.name).toMatch(/^TODO:/);
  });
});

describe("FEATURED_PLAN_KEY", () => {
  it("names a plan that actually exists in the catalogue", () => {
    expect(PLANS[FEATURED_PLAN_KEY]).toBeDefined();
  });

  it("is a paid plan — a free plan is never what a pricing page features", () => {
    expect(PLANS[FEATURED_PLAN_KEY].priceMonthly.amount).toBeGreaterThan(0);
  });
});

describe("cheapestPaidPlanKey", () => {
  const plan = (key: string, monthly: number) => ({
    key,
    priceMonthly: { amount: monthly },
  });

  it("picks the cheapest plan anyone actually pays for", () => {
    // Derived from the ladder, so adding a tier below the current entry plan
    // moves the highlight on its own.
    expect(
      cheapestPaidPlanKey([plan("free", 0), plan("starter", 900), plan("pro", 1900)]),
    ).toBe("starter");
  });

  it("ignores free plans when choosing", () => {
    expect(cheapestPaidPlanKey([plan("free", 0), plan("pro", 1900)])).toBe("pro");
  });

  it("falls back to the first plan when every plan is free", () => {
    // Nothing is for sale, so there is nothing to upsell — but the UI still
    // needs a key rather than undefined.
    expect(cheapestPaidPlanKey([plan("free", 0), plan("also-free", 0)])).toBe("free");
  });
});

describe("priceFor", () => {
  it("reads the monthly column for a monthly interval", () => {
    expect(priceFor(PLANS.pro, "monthly")).toEqual(PLANS.pro.priceMonthly);
  });

  it("reads the annual column for an annual interval", () => {
    expect(priceFor(PLANS.pro, "annual")).toEqual(PLANS.pro.priceAnnual);
  });
});

describe("planForShopifyHandle", () => {
  it("resolves a known handle to its plan", () => {
    expect(planForShopifyHandle(PLANS.pro.shopifyPlanHandle)?.key).toBe("pro");
  });

  it("returns null for an unrecognised handle", () => {
    expect(planForShopifyHandle("some-other-apps-handle")).toBeNull();
  });

  it("returns null for a missing handle", () => {
    expect(planForShopifyHandle(null)).toBeNull();
    expect(planForShopifyHandle(undefined)).toBeNull();
  });
});
