import { describe, it, expect } from "vitest";
import { resolveBillingStatus, resolveProjectionBillingStatus, type AppSubscriptionLike } from "./subscription-status";

const NOW = Date.parse("2026-01-15T00:00:00.000Z");

function recurringSub(overrides: Partial<AppSubscriptionLike> = {}): AppSubscriptionLike {
  return {
    name: "TODO:PRO",
    status: "ACTIVE",
    test: false,
    trialDays: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    lineItems: [
      {
        plan: {
          pricingDetails: {
            interval: "EVERY_30_DAYS",
            price: { amount: 19, currencyCode: "USD" },
          },
        },
      },
    ],
    ...overrides,
  };
}

describe("resolveBillingStatus", () => {
  it("reports free when there is no active payment", () => {
    const status = resolveBillingStatus({ hasActivePayment: false, appSubscriptions: [] }, NOW);
    expect(status).toEqual({ kind: "free" });
  });

  it("reports free when hasActivePayment is true but there is no subscription row (a one-time purchase)", () => {
    const status = resolveBillingStatus({ hasActivePayment: true, appSubscriptions: [] }, NOW);
    expect(status).toEqual({ kind: "free" });
  });

  it("reports an active recurring subscription with its next charge date and price", () => {
    const status = resolveBillingStatus(
      { hasActivePayment: true, appSubscriptions: [recurringSub()] },
      NOW,
    );
    expect(status).toMatchObject({
      kind: "subscribed",
      name: "TODO:PRO",
      status: "ACTIVE",
      test: false,
      price: { amount: 1900, currency: "USD" },
      interval: "every_30_days",
      trialEndsAt: null,
      periodEnd: Date.parse("2026-02-01T00:00:00.000Z"),
    });
  });

  it("reports the trial end date while a trial is still running", () => {
    const status = resolveBillingStatus(
      {
        hasActivePayment: true,
        appSubscriptions: [
          recurringSub({ trialDays: 14, createdAt: "2026-01-10T00:00:00.000Z" }),
        ],
      },
      NOW, // 5 days into a 14-day trial that started 2026-01-10
    );
    expect(status).toMatchObject({
      kind: "subscribed",
      trialEndsAt: Date.parse("2026-01-24T00:00:00.000Z"),
    });
  });

  it("does not report a trial that has already ended", () => {
    const status = resolveBillingStatus(
      {
        hasActivePayment: true,
        appSubscriptions: [
          recurringSub({ trialDays: 3, createdAt: "2026-01-01T00:00:00.000Z" }),
        ],
      },
      NOW, // trial ended 2026-01-04, long before NOW
    );
    expect(status).toMatchObject({ trialEndsAt: null });
  });

  it("flags a Shopify test charge", () => {
    const status = resolveBillingStatus(
      { hasActivePayment: true, appSubscriptions: [recurringSub({ test: true })] },
      NOW,
    );
    expect(status).toMatchObject({ test: true });
  });

  it.each(["PENDING", "DECLINED", "FROZEN", "EXPIRED", "CANCELLED", "ACCEPTED"] as const)(
    "carries a %s subscription's status through as-is",
    (subStatus) => {
      const status = resolveBillingStatus(
        { hasActivePayment: true, appSubscriptions: [recurringSub({ status: subStatus })] },
        NOW,
      );
      expect(status).toMatchObject({ kind: "subscribed", status: subStatus });
    },
  );

  it("reports no price or interval for a usage-based plan", () => {
    const status = resolveBillingStatus(
      {
        hasActivePayment: true,
        appSubscriptions: [
          recurringSub({
            lineItems: [
              {
                plan: {
                  pricingDetails: {
                    balanceUsed: { amount: 5, currencyCode: "USD" },
                  },
                },
              },
            ],
          }),
        ],
      },
      NOW,
    );
    expect(status).toMatchObject({ price: null, interval: null });
  });
});

describe("resolveProjectionBillingStatus", () => {
  it("uses the Partner-backed projection without the legacy Billing API", () => {
    expect(resolveProjectionBillingStatus({
      status: "ACTIVE",
      planHandle: "pro",
      billingInterval: "EVERY_30_DAYS",
      priceAmount: 1900,
      priceCurrency: "USD",
      trialEndsAt: null,
      currentPeriodEndsAt: 1_800_000_000_000,
    }, "Pro", 1_700_000_000_000)).toMatchObject({
      kind: "subscribed",
      name: "Pro",
      price: { amount: 1900, currency: "USD" },
      interval: "every_30_days",
      periodEnd: 1_800_000_000_000,
    });
  });
  it("treats NONE as the free plan", () => {
    expect(resolveProjectionBillingStatus({ status: "NONE", planHandle: null, billingInterval: null, priceAmount: null, priceCurrency: null, trialEndsAt: null, currentPeriodEndsAt: null }, "Free", 1_700_000_000_000)).toEqual({ kind: "free" });
  });
});
