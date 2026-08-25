import { describe, it, expect } from "vitest";
import { annualSavingPercent } from "./annual-savings";
import { PLANS } from "./plans";
import { fromMinorUnits, toCurrency } from "~/money";
import { unwrap } from "~/lib/result";

const USD = unwrap(toCurrency("USD"));
const money = (amount: number) => unwrap(fromMinorUnits(amount, USD));

describe("annualSavingPercent", () => {
  it("is the whole-percent discount against twelve monthly charges", () => {
    // 12 × $19.00 = $228.00; annual $190.00 saves $38.00 → 17%.
    expect(
      annualSavingPercent({ priceMonthly: money(1900), priceAnnual: money(19000) }),
    ).toBe(17);
  });

  it("reports the textbook two-months-free discount as 17%", () => {
    // Ten months' money for twelve months' service.
    expect(
      annualSavingPercent({ priceMonthly: money(1000), priceAnnual: money(10000) }),
    ).toBe(17);
  });

  it("returns null for a free plan, where there is nothing to discount", () => {
    expect(
      annualSavingPercent({ priceMonthly: money(0), priceAnnual: money(0) }),
    ).toBeNull();
  });

  it("returns null when the annual price is no cheaper", () => {
    // The UI must never advertise a saving of 0%.
    expect(
      annualSavingPercent({ priceMonthly: money(1000), priceAnnual: money(12000) }),
    ).toBeNull();
  });

  it("returns null when annual costs more than monthly", () => {
    expect(
      annualSavingPercent({ priceMonthly: money(1000), priceAnnual: money(13000) }),
    ).toBeNull();
  });

  it("returns null when a saving rounds to nothing", () => {
    // 12 × $10.00 = $120.00 against $119.99 is 0.008% — real, but not a claim
    // worth making, and "save 0%" would be absurd.
    expect(
      annualSavingPercent({ priceMonthly: money(1000), priceAnnual: money(11999) }),
    ).toBeNull();
  });

  it("refuses to mix currencies rather than reporting a wrong percentage", () => {
    const EUR = unwrap(toCurrency("EUR"));
    expect(
      annualSavingPercent({
        priceMonthly: money(1900),
        priceAnnual: unwrap(fromMinorUnits(19000, EUR)),
      }),
    ).toBeNull();
  });

  it("computes a real discount for the catalogue's own paid plan", () => {
    const percent = annualSavingPercent(PLANS.pro);
    expect(percent).not.toBeNull();
    expect(percent).toBeGreaterThan(0);
  });
});
