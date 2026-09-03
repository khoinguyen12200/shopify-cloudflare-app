import { describe, it, expect } from "vitest";
import { currentPlanHandleFor } from "./current-plan";
import { PLANS } from "./plans";
import type { BillingStatus } from "./subscription-status";

const FREE_STATUS: BillingStatus = { kind: "free" };

function subscribed(name: string): BillingStatus {
  return {
    kind: "subscribed",
    name,
    status: "ACTIVE",
    test: false,
    price: null,
    interval: null,
    trialEndsAt: null,
    periodEnd: 1_700_000_000_000,
  };
}

describe("currentPlanHandleFor", () => {
  it("resolves the free plan when there is no active payment", () => {
    expect(currentPlanHandleFor(FREE_STATUS)).toBe("free");
  });

  it("resolves a subscribed status by immutable Shopify plan handle, not display name", () => {
    expect(currentPlanHandleFor(subscribed("Professional"), "pro")).toBe("pro");
  });

  it("does not guess a paid card when its Shopify handle is unknown", () => {
    expect(currentPlanHandleFor(subscribed(PLANS.pro.name), "retired-plan")).toBeNull();
  });

  it("does not select a card before the active subscription handle is projected", () => {
    expect(currentPlanHandleFor(subscribed(PLANS.pro.name), null)).toBeNull();
  });
});
