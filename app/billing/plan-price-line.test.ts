import { describe, it, expect } from "vitest";
import { planPriceLine } from "./plan-price-line";
import type { BillingStatus } from "./subscription-status";
import { fromMinorUnits, toCurrency } from "~/money";
import { unwrap } from "~/lib/result";

const USD = unwrap(toCurrency("USD"));
const price = (minor: number) => unwrap(fromMinorUnits(minor, USD));

const subscribed = (
  over: Partial<Extract<BillingStatus, { kind: "subscribed" }>> = {},
): BillingStatus => ({
  kind: "subscribed",
  name: "Pro",
  status: "ACTIVE",
  test: false,
  price: price(2999),
  interval: "every_30_days",
  trialEndsAt: null,
  periodEnd: 1_800_000_000_000,
  ...over,
});

describe("the price line on the billing page", () => {
  it("shows zero per month on the free plan", () => {
    // Free is not a subscription, so there is no Shopify figure to read — but
    // the charge really is zero, so it is stated rather than hidden.
    const line = planPriceLine({ kind: "free" });

    expect(line).not.toBeNull();
    expect(line?.cadence).toBe("monthly");
    expect(line?.price.amount).toBe(0);
  });

  it("quotes a monthly subscriber their monthly price", () => {
    const line = planPriceLine(subscribed({ interval: "every_30_days" }));
    expect(line).toEqual({ price: price(2999), cadence: "monthly" });
  });

  it("quotes an ANNUAL subscriber the annual price, not a monthly one", () => {
    // The bug this function exists to prevent: calling a yearly charge "/mo"
    // misstates what actually leaves the merchant's account.
    const line = planPriceLine(subscribed({ interval: "annual", price: price(29900) }));
    expect(line).toEqual({ price: price(29900), cadence: "yearly" });
  });

  it("omits the cadence when Shopify did not report an interval", () => {
    // We know the amount but not how often. Appending "/mo" would be a guess
    // about a real charge, so the figure is shown bare.
    const line = planPriceLine(subscribed({ interval: null }));
    expect(line).toEqual({ price: price(2999), cadence: "none" });
  });

  it("shows NO figure at all when the subscription carries no price", () => {
    // Falling back to the catalogue price here would quote a number the
    // merchant may not be paying.
    expect(planPriceLine(subscribed({ price: null }))).toBeNull();
  });

  it("still shows no figure when the price is missing but the interval is known", () => {
    expect(planPriceLine(subscribed({ price: null, interval: "annual" }))).toBeNull();
  });

  it("keeps the subscription's own currency rather than assuming USD", () => {
    const eur = unwrap(toCurrency("EUR"));
    const line = planPriceLine(subscribed({ price: unwrap(fromMinorUnits(1900, eur)) }));
    expect(line?.price.currency).toBe("EUR");
  });
});
