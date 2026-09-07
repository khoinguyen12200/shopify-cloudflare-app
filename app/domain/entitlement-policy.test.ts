import { describe, expect, it } from "vitest";
import * as policy from "./entitlement-policy";

describe("entitlement policy contract", () => {
  it("derives concrete lifetime, UTC month, and billing usage windows", () => {
    const subscription: policy.SubscriptionSnapshot = { status: "ACTIVE", planHandle: "free", revision: 1 };
    expect(policy.resolveUsageWindow("lifetime", 0, subscription)).toEqual({ kind: "lifetime", key: "lifetime" });
    expect(policy.resolveUsageWindow("calendar_month", Date.UTC(2026, 8, 7), subscription)).toEqual({ kind: "calendar_month", key: "2026-09", start: Date.UTC(2026, 8, 1), end: Date.UTC(2026, 9, 1) });
    expect(policy.resolveUsageWindow("billing_period", 15, { ...subscription, periodStart: 10, periodEnd: 20 })).toEqual({ kind: "billing_period", key: "10:20", start: 10, end: 20 });
  });
  it("resolves a capability grant for an active subscription", () => {
    const catalogue: policy.EntitlementCatalogue = {
      version: 1,
      freePlan: "free",
      features: { "reports.view": { kind: "capability" } },
      plans: { free: { "reports.view": { kind: "enabled" } } },
    };
    const result = policy.resolveEntitlement(
      catalogue,
      { status: "ACTIVE", planHandle: "free", revision: 1 },
      "reports.view",
      0,
    );
    expect(result).toEqual({ allowed: true, kind: "capability" });
  });

  it("resolves a reusable capacity maximum", () => {
    const catalogue: policy.EntitlementCatalogue = {
      version: 1,
      freePlan: "free",
      features: { "staff.max": { kind: "capacity" } },
      plans: { free: { "staff.max": { kind: "limit", maximum: 1 } } },
    };
    expect(policy.resolveEntitlement(catalogue, { status: "ACTIVE", planHandle: "free", revision: 1 }, "staff.max", 0)).toEqual({
      allowed: true,
      kind: "capacity",
      maximum: 1,
    });
  });

  it("fails closed for inactive subscriptions", () => {
    const catalogue: policy.EntitlementCatalogue = { version: 1, freePlan: "free", features: { x: { kind: "capability" } }, plans: { free: { x: { kind: "enabled" } } } };
    expect(policy.resolveEntitlement(catalogue, { status: "CANCELED", planHandle: "free", revision: 1 }, "x", 0)).toEqual({ allowed: false, reason: "inactive_subscription" });
  });

  it("preserves a lifetime quota period", () => {
    const catalogue: policy.EntitlementCatalogue = { version: 1, freePlan: "free", features: { exports: { kind: "quota", period: "lifetime" } }, plans: { free: { exports: { kind: "limit", maximum: 1 } } } };
    expect(policy.resolveEntitlement(catalogue, { status: "ACTIVE", planHandle: null, revision: 1 }, "exports", 0)).toEqual({ allowed: true, kind: "quota", maximum: 1, period: "lifetime", window: { kind: "lifetime", key: "lifetime" } });
  });
});
