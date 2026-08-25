import { describe, it, expect } from "vitest";
import { currentPlanKeyFor } from "./current-plan";
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

describe("currentPlanKeyFor", () => {
  it("resolves the free plan when there is no active payment", () => {
    expect(currentPlanKeyFor(FREE_STATUS)).toBe("free");
  });

  it("resolves a subscribed status to whichever catalogue plan shares its name", () => {
    expect(currentPlanKeyFor(subscribed(PLANS.pro.name))).toBe("pro");
  });

  it("falls back to free for a subscribed status matching no known plan", () => {
    // A renamed or retired plan on Shopify's side should never crash the page —
    // it should read as "not on a plan we recognise" rather than "pro".
    expect(currentPlanKeyFor(subscribed("Some Retired Plan Name"))).toBe("free");
  });
});
