import { describe, expect, it } from "vitest";
import * as policy from "./entitlement-policy";

describe("entitlement policy contract", () => {
  const quotaCatalogue: policy.EntitlementCatalogue = {
    version: 1,
    freePlan: "free",
    features: { exports: { kind: "quota", period: "calendar_month" } },
    plans: { free: { exports: { kind: "limit", maximum: 5 } } },
  };

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
  it("fails closed for unsupported catalogue versions", () => {
    const catalogue: policy.EntitlementCatalogue = { version: 99, freePlan: "free", features: { x: { kind: "capability" } }, plans: { free: { x: { kind: "enabled" } } } };
    expect(policy.resolveEntitlement(catalogue, { status: "ACTIVE", planHandle: "free", revision: 1 }, "x", 0)).toEqual({ allowed: false, reason: "invalid_catalogue" });
  });

  it("preserves a lifetime quota period", () => {
    const catalogue: policy.EntitlementCatalogue = { version: 1, freePlan: "free", features: { exports: { kind: "quota", period: "lifetime" } }, plans: { free: { exports: { kind: "limit", maximum: 1 } } } };
    expect(policy.resolveEntitlement(catalogue, { status: "ACTIVE", planHandle: null, revision: 1 }, "exports", 0)).toEqual({ allowed: true, kind: "quota", maximum: 1, period: "lifetime", window: { kind: "lifetime", key: "lifetime" } });
  });

  it("uses the free plan for a NONE subscription", () => {
    const catalogue: policy.EntitlementCatalogue = {
      version: 1,
      freePlan: "free",
      features: { "reports.view": { kind: "capability" } },
      plans: { free: { "reports.view": { kind: "enabled" } } },
    };
    expect(policy.resolveEntitlement(catalogue, { status: "NONE", planHandle: null, revision: 0 }, "reports.view", 0)).toEqual({
      allowed: true,
      kind: "capability",
    });
  });

  it("uses the free plan for a NONE subscription regardless of stale plan handle", () => {
    const catalogue: policy.EntitlementCatalogue = { version: 1, freePlan: "free", features: { x: { kind: "capability" } }, plans: { free: { x: { kind: "enabled" } }, paid: { x: { kind: "disabled" } } } };
    expect(policy.resolveEntitlement(catalogue, { status: "NONE", planHandle: "paid", revision: 0 }, "x", 0)).toEqual({ allowed: true, kind: "capability" });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid clock value %s",
    (now) => {
      expect(policy.resolveUsageWindow("calendar_month", now, { status: "ACTIVE", planHandle: "free", revision: 1 })).toBeNull();
      expect(policy.resolveEntitlement(quotaCatalogue, { status: "ACTIVE", planHandle: "free", revision: 1 }, "exports", now)).toEqual({ allowed: false, reason: "invalid_usage_window" });
    },
  );

  it("uses exact UTC calendar boundaries including leap day", () => {
    const subscription: policy.SubscriptionSnapshot = { status: "ACTIVE", planHandle: "free", revision: 1 };
    expect(policy.resolveUsageWindow("calendar_month", Date.UTC(2024, 1, 29, 23, 59, 59, 999), subscription)).toEqual({
      kind: "calendar_month",
      key: "2024-02",
      start: Date.UTC(2024, 1, 1),
      end: Date.UTC(2024, 2, 1),
    });
    expect(policy.resolveUsageWindow("calendar_month", Date.UTC(2024, 2, 1), subscription)?.key).toBe("2024-03");
  });

  it.each([
    {},
    { periodStart: 10 },
    { periodEnd: 20 },
    { periodStart: 20, periodEnd: 10 },
    { periodStart: 10, periodEnd: 10 },
    { periodStart: 10.5, periodEnd: 20 },
    { periodStart: 10, periodEnd: Number.POSITIVE_INFINITY },
  ])("rejects missing or invalid billing bounds %#", (bounds) => {
    expect(policy.resolveUsageWindow("billing_period", 15, { status: "ACTIVE", planHandle: "free", revision: 1, ...bounds })).toBeNull();
  });

  it("accepts billing start and rejects the exact end boundary", () => {
    const subscription: policy.SubscriptionSnapshot = { status: "ACTIVE", planHandle: "free", revision: 1, periodStart: 10, periodEnd: 20 };
    expect(policy.resolveUsageWindow("billing_period", 10, subscription)).not.toBeNull();
    expect(policy.resolveUsageWindow("billing_period", 20, subscription)).toBeNull();
  });

  it.each(["PENDING", "FROZEN", "CANCELED", "UNKNOWN"] as const)("denies %s subscriptions", (status) => {
    expect(policy.resolveEntitlement(quotaCatalogue, { status, planHandle: "free", revision: 1 }, "exports", 0)).toEqual({ allowed: false, reason: "inactive_subscription" });
  });

  it("honors scheduled cancellation only before its exact boundary", () => {
    const subscription: policy.SubscriptionSnapshot = { status: "CANCELLATION_SCHEDULED", planHandle: "free", revision: 1, cancellationEffectiveAt: 20 };
    expect(policy.resolveEntitlement(quotaCatalogue, subscription, "exports", 19).allowed).toBe(true);
    expect(policy.resolveEntitlement(quotaCatalogue, subscription, "exports", 20)).toEqual({ allowed: false, reason: "inactive_subscription" });
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN, 20.5])("fails closed for malformed cancellation metadata %s", (cancellationEffectiveAt) => {
    expect(policy.resolveEntitlement(quotaCatalogue, { status: "CANCELLATION_SCHEDULED", planHandle: "free", revision: 1, cancellationEffectiveAt }, "exports", 19)).toEqual({
      allowed: false,
      reason: "inactive_subscription",
    });
  });

  it("fails closed for unknown and prototype feature keys and unknown plans", () => {
    const subscription: policy.SubscriptionSnapshot = { status: "ACTIVE", planHandle: "free", revision: 1 };
    expect(policy.resolveEntitlement(quotaCatalogue, subscription, "missing", 0)).toEqual({ allowed: false, reason: "unknown_feature" });
    expect(policy.resolveEntitlement(quotaCatalogue, subscription, "toString", 0)).toEqual({ allowed: false, reason: "unknown_feature" });
    expect(policy.resolveEntitlement(quotaCatalogue, { ...subscription, planHandle: "missing" }, "exports", 0)).toEqual({ allowed: false, reason: "unknown_plan" });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects malformed limit maximum %s",
    (maximum) => {
      const catalogue: policy.EntitlementCatalogue = { ...quotaCatalogue, plans: { free: { exports: { kind: "limit", maximum } } } };
      expect(policy.resolveEntitlement(catalogue, { status: "ACTIVE", planHandle: "free", revision: 1 }, "exports", 0)).toEqual({ allowed: false, reason: "invalid_grant" });
    },
  );

  it("calculates bounded advisory remaining counts", () => {
    expect(policy.calculateRemaining(5, 0)).toBe(5);
    expect(policy.calculateRemaining(5, 5)).toBe(0);
    expect(policy.calculateRemaining(1, 2)).toBe(0);
    expect(policy.calculateRemaining(Number.MAX_SAFE_INTEGER, 0)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([
    [Number.NaN, 0],
    [5, Number.POSITIVE_INFINITY],
    [-1, 0],
    [5, -1],
    [1.5, 0],
    [5, 1.5],
    [Number.MAX_SAFE_INTEGER + 1, 0],
    [5, Number.MAX_SAFE_INTEGER + 1],
  ])("rejects malformed remaining inputs %#", (maximum, used) => {
    expect(policy.calculateRemaining(maximum, used)).toBeNull();
  });
});
