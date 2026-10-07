import { describe, expect, it } from "vitest";
import { resolveEffectivePlan, isPromoGrantActive } from "./plan-hierarchy";
import { PLAN_LIST } from "~/billing/plans";

describe("plan-hierarchy resolution", () => {
  const baseNow = 1_000_000_000;
  const tenDaysMs = 10 * 86_400_000;

  it("returns organic free plan when no promo is active", () => {
    const result = resolveEffectivePlan("free", "NONE", null, PLAN_LIST, baseNow);
    expect(result).toEqual({
      planHandle: "free",
      source: "organic",
      activePromo: null,
    });
  });

  it("upgrades free store to promo plan when promo is active", () => {
    const promo = {
      planHandle: "pro",
      startsAt: baseNow - 1000,
      expiresAt: baseNow + tenDaysMs,
      revokedAt: null,
    };
    const result = resolveEffectivePlan("free", "NONE", promo, PLAN_LIST, baseNow);
    expect(result).toEqual({
      planHandle: "pro",
      source: "promo",
      activePromo: {
        planHandle: "pro",
        expiresAt: baseNow + tenDaysMs,
        remainingDays: 10,
      },
    });
  });

  it("keeps paid organic plan when paid organic tier is equal or higher than promo", () => {
    const promo = {
      planHandle: "pro",
      startsAt: baseNow - 1000,
      expiresAt: baseNow + tenDaysMs,
      revokedAt: null,
    };
    const result = resolveEffectivePlan("pro", "ACTIVE", promo, PLAN_LIST, baseNow);
    expect(result).toEqual({
      planHandle: "pro",
      source: "organic",
      activePromo: {
        planHandle: "pro",
        expiresAt: baseNow + tenDaysMs,
        remainingDays: 10,
      },
    });
  });

  it("falls back to organic plan when promo has expired", () => {
    const expiredPromo = {
      planHandle: "pro",
      startsAt: baseNow - 20 * 86_400_000,
      expiresAt: baseNow - 1000,
      revokedAt: null,
    };
    const result = resolveEffectivePlan("free", "NONE", expiredPromo, PLAN_LIST, baseNow);
    expect(result).toEqual({
      planHandle: "free",
      source: "organic",
      activePromo: null,
    });
  });

  it("falls back to organic plan when promo has been revoked", () => {
    const revokedPromo = {
      planHandle: "pro",
      startsAt: baseNow - 1000,
      expiresAt: baseNow + tenDaysMs,
      revokedAt: baseNow - 500,
    };
    const result = resolveEffectivePlan("free", "NONE", revokedPromo, PLAN_LIST, baseNow);
    expect(result).toEqual({
      planHandle: "free",
      source: "organic",
      activePromo: null,
    });
  });

  it("correctly identifies active vs inactive promo grants", () => {
    expect(isPromoGrantActive(null, baseNow)).toBe(false);
    expect(isPromoGrantActive({ planHandle: "pro", startsAt: baseNow + 100, expiresAt: baseNow + 1000, revokedAt: null }, baseNow)).toBe(false);
    expect(isPromoGrantActive({ planHandle: "pro", startsAt: baseNow - 100, expiresAt: baseNow - 50, revokedAt: null }, baseNow)).toBe(false);
    expect(isPromoGrantActive({ planHandle: "pro", startsAt: baseNow - 100, expiresAt: baseNow + 1000, revokedAt: baseNow - 10 }, baseNow)).toBe(false);
    expect(isPromoGrantActive({ planHandle: "pro", startsAt: baseNow - 100, expiresAt: baseNow + 1000, revokedAt: null }, baseNow)).toBe(true);
  });
});
