import { describe, it, expect } from "vitest";
import { unwrap } from "~/lib/result";
import {
  add,
  allocate,
  applyRate,
  compare,
  equals,
  formatMoney,
  fromDecimalString,
  fromMinorUnits,
  fromMoneyV2,
  fromNullableMoneyV2,
  multiply,
  negate,
  subtract,
  sum,
  toCurrency,
  toDecimalString,
  toMoneyV2,
  zero,
} from "./index";
import type { Money } from "./types";

const USD = unwrap(toCurrency("USD"));
const JPY = unwrap(toCurrency("JPY"));
const KWD = unwrap(toCurrency("KWD"));

/** Shorthand for a value already proven correct. */
const m = (minor: number, currency = USD): Money =>
  unwrap(fromMinorUnits(minor, currency));

describe("currency decimals come from Intl, not from 100", () => {
  it("knows 2, 0 and 3 decimal currencies", () => {
    expect(unwrap(fromDecimalString("19.99", "USD")).amount).toBe(1999);
    // ¥1000 is 1000 minor units, not 100000.
    expect(unwrap(fromDecimalString("1000", "JPY")).amount).toBe(1000);
    // KWD has three.
    expect(unwrap(fromDecimalString("1.234", "KWD")).amount).toBe(1234);
  });

  it("rejects an unknown currency", () => {
    expect(toCurrency("ZZZ").ok).toBe(false);
    expect(toCurrency("US").ok).toBe(false);
    expect(toCurrency("DOLLARS").ok).toBe(false);
  });

  it("accepts a lower-case code and normalises it", () => {
    expect(unwrap(toCurrency("usd"))).toBe("USD");
  });
});

describe("parsing never goes through a float", () => {
  it("parses the value that breaks parseFloat", () => {
    // Number("0.615") is already 0.6149999… — so a float route rounds this DOWN
    // to 61. Digit parsing gets it right.
    expect(unwrap(fromDecimalString("0.615", "USD", { allowRounding: true })).amount).toBe(62);
  });

  it("keeps large amounts exact", () => {
    // Well past where a float would start losing cents.
    expect(unwrap(fromDecimalString("99999999.99", "USD")).amount).toBe(9999999999);
  });

  it("handles a whole number with no decimal point", () => {
    expect(unwrap(fromDecimalString("100", "USD")).amount).toBe(10000);
  });

  it("handles fewer decimals than the currency has", () => {
    expect(unwrap(fromDecimalString("19.9", "USD")).amount).toBe(1990);
  });

  it("handles a leading dot", () => {
    expect(unwrap(fromDecimalString(".50", "USD")).amount).toBe(50);
  });

  it("handles negatives — a refund is money too", () => {
    expect(unwrap(fromDecimalString("-5.50", "USD")).amount).toBe(-550);
  });

  it("accepts a leading plus", () => {
    expect(unwrap(fromDecimalString("+5.50", "USD")).amount).toBe(550);
  });

  it("treats trailing zeros as precision it does not need", () => {
    // "29.9900" IS exactly 29.99, so refusing it would be wrong.
    expect(unwrap(fromDecimalString("29.9900", "USD")).amount).toBe(2999);
  });

  it("REFUSES real precision loss by default", () => {
    // Shopify's Decimal is arbitrary precision and their docs use "29.999".
    // Silently truncating loses a tenth of a cent per line.
    const result = fromDecimalString("29.999", "USD");
    expect(result).toMatchObject({ ok: false, reason: "precision_loss" });
  });

  it("rounds only when told to, away from zero", () => {
    expect(unwrap(fromDecimalString("29.999", "USD", { allowRounding: true })).amount).toBe(3000);
    expect(unwrap(fromDecimalString("29.994", "USD", { allowRounding: true })).amount).toBe(2999);
    // Symmetric: a refund of the same magnitude rounds the same way.
    expect(unwrap(fromDecimalString("-29.995", "USD", { allowRounding: true })).amount).toBe(-3000);
    expect(unwrap(fromDecimalString("29.995", "USD", { allowRounding: true })).amount).toBe(3000);
  });

  it("rejects junk rather than guessing", () => {
    for (const bad of ["", " ", "abc", "1.2.3", "1,50", "$5", "1e3", "--5", "."]) {
      expect(fromDecimalString(bad, "USD").ok, bad).toBe(false);
    }
  });
});

describe("fromMinorUnits guards the brand", () => {
  it("rejects a major-unit float — the footgun this exists to stop", () => {
    // Without this, formatMoney would render $0.20 for a $19.99 price.
    expect(fromMinorUnits(19.99, USD)).toMatchObject({
      ok: false,
      reason: "malformed_amount",
    });
  });

  it("accepts a whole number", () => {
    expect(unwrap(fromMinorUnits(1999, USD)).amount).toBe(1999);
  });

  it("accepts zero and negatives", () => {
    expect(unwrap(fromMinorUnits(0, USD)).amount).toBe(0);
    expect(unwrap(fromMinorUnits(-500, USD)).amount).toBe(-500);
  });
});

describe("Shopify MoneyV2 round trip", () => {
  it("parses what the Admin API sends", () => {
    const money = unwrap(fromMoneyV2({ amount: "29.99", currencyCode: "USD" }));
    expect(money).toEqual({ amount: 2999, currency: "USD" });
  });

  it("returns to the exact same string", () => {
    for (const [amount, currency] of [
      ["29.99", "USD"],
      ["0.01", "USD"],
      ["19.90", "USD"],
      ["1000", "JPY"],
      ["1.234", "KWD"],
      ["-5.50", "USD"],
      ["99999999.99", "USD"],
    ] as const) {
      const parsed = unwrap(fromDecimalString(amount, currency));
      expect(toDecimalString(parsed), `${amount} ${currency}`).toBe(amount);
    }
  });

  it("produces a MoneyV2 for a GraphQL variable", () => {
    expect(toMoneyV2(m(2999))).toEqual({ amount: "29.99", currencyCode: "USD" });
  });

  it("treats a null money field as null, not an error", () => {
    // Shopify nulls these routinely — no discount, no shipping.
    expect(unwrap(fromNullableMoneyV2(null))).toBeNull();
    expect(unwrap(fromNullableMoneyV2(undefined))).toBeNull();
  });
});

describe("arithmetic refuses mismatched currencies", () => {
  it("on every binary operation", () => {
    const usd = m(500);
    const jpy = m(500, JPY);
    for (const result of [add(usd, jpy), subtract(usd, jpy), compare(usd, jpy)]) {
      expect(result).toMatchObject({ ok: false, reason: "currency_mismatch" });
    }
  });

  it("and equals() is false rather than throwing", () => {
    expect(equals(m(500), m(500, JPY))).toBe(false);
  });
});

describe("arithmetic stays exact", () => {
  it("adds and subtracts", () => {
    expect(unwrap(add(m(1999), m(1))).amount).toBe(2000);
    expect(unwrap(subtract(m(2000), m(1))).amount).toBe(1999);
  });

  it("sums a list, and an empty list is zero", () => {
    expect(unwrap(sum([m(100), m(200), m(300)], USD)).amount).toBe(600);
    expect(unwrap(sum([], USD))).toEqual(zero(USD));
  });

  it("multiplies by a quantity", () => {
    expect(unwrap(multiply(m(1999), 3)).amount).toBe(5997);
  });

  it("refuses a fractional quantity, pointing at applyRate", () => {
    expect(multiply(m(1999), 1.5)).toMatchObject({
      ok: false,
      reason: "malformed_amount",
    });
  });

  it("negates", () => {
    expect(negate(m(1999)).amount).toBe(-1999);
  });

  it("does not silently overflow", () => {
    const huge = m(Number.MAX_SAFE_INTEGER);
    expect(add(huge, m(1))).toMatchObject({ ok: false, reason: "out_of_range" });
    expect(multiply(huge, 2)).toMatchObject({ ok: false, reason: "out_of_range" });
  });
});

describe("applyRate makes the rounding decision explicit", () => {
  it("applies a tax rate", () => {
    // 8.25% of $19.99 = 164.9175 minor units.
    expect(unwrap(applyRate(m(1999), 0.0825, "half_away_from_zero")).amount).toBe(165);
    expect(unwrap(applyRate(m(1999), 0.0825, "down")).amount).toBe(164);
    expect(unwrap(applyRate(m(1999), 0.0825, "up")).amount).toBe(165);
  });

  it("treats a refund symmetrically with half_away_from_zero", () => {
    // half_up rounds -0.5 to 0 and +0.5 to 1 — asymmetric, and for a refund that
    // is a cent that appears out of nowhere.
    expect(unwrap(applyRate(m(-1), 0.5, "half_away_from_zero")).amount).toBe(-1);
    expect(unwrap(applyRate(m(1), 0.5, "half_away_from_zero")).amount).toBe(1);
  });

  it("rejects a non-finite rate", () => {
    expect(applyRate(m(100), Number.NaN, "half_up").ok).toBe(false);
    expect(applyRate(m(100), Number.POSITIVE_INFINITY, "half_up").ok).toBe(false);
  });
});

describe("allocate never loses or invents a unit", () => {
  it("splits $10 three ways as 334/333/333, not 333/333/333", () => {
    // Dividing and rounding gives $9.99 and the missing cent turns up later as an
    // unbalanced order.
    const shares = unwrap(allocate(m(1000), [1, 1, 1]));
    expect(shares.map((s) => s.amount)).toEqual([334, 333, 333]);
  });

  it("respects weights", () => {
    const shares = unwrap(allocate(m(1000), [3, 1]));
    expect(shares.map((s) => s.amount)).toEqual([750, 250]);
  });

  it("splits a refund the same way", () => {
    const shares = unwrap(allocate(m(-1000), [1, 1, 1]));
    expect(shares.map((s) => s.amount)).toEqual([-334, -333, -333]);
  });

  it("handles a zero weight without giving it anything", () => {
    const shares = unwrap(allocate(m(1000), [1, 0, 1]));
    expect(shares.map((s) => s.amount)).toEqual([500, 0, 500]);
  });

  it("is deterministic on ties — earlier index wins the extra unit", () => {
    expect(unwrap(allocate(m(100), [1, 1, 1])).map((s) => s.amount)).toEqual([
      34, 33, 33,
    ]);
  });

  it("rejects no weights, negative weights, and weights summing to zero", () => {
    expect(allocate(m(100), []).ok).toBe(false);
    expect(allocate(m(100), [1, -1]).ok).toBe(false);
    expect(allocate(m(100), [0, 0]).ok).toBe(false);
  });

  it("PROPERTY: shares always sum back to the input", () => {
    // The invariant that makes allocate worth having. Deterministic inputs rather
    // than Math.random, so a failure is reproducible.
    let checked = 0;
    for (let total = -500; total <= 500; total += 7) {
      for (let parts = 1; parts <= 7; parts += 1) {
        for (const shape of [
          Array.from({ length: parts }, () => 1),
          Array.from({ length: parts }, (_, i) => i + 1),
          Array.from({ length: parts }, (_, i) => (i % 2 === 0 ? 3 : 1)),
        ]) {
          const shares = unwrap(allocate(m(total), shape));
          const rebuilt = shares.reduce((acc, s) => acc + s.amount, 0);
          expect(rebuilt, `total=${total} weights=${shape}`).toBe(total);
          checked += 1;
        }
      }
    }
    // Guard against the loops silently not running.
    expect(checked).toBeGreaterThan(1000);
  });
});

describe("formatting", () => {
  it("renders per locale", () => {
    expect(formatMoney("en-US", m(1999))).toBe("$19.99");
    // Non-breaking space and comma decimal in de-DE.
    expect(formatMoney("de-DE", unwrap(fromDecimalString("19.99", "EUR")))).toContain(
      "19,99",
    );
  });

  it("does not drop a trailing zero", () => {
    // Some locales would render $19.9 without the pinned fraction digits.
    expect(formatMoney("en-US", m(1990))).toBe("$19.90");
  });

  it("renders a zero-decimal currency with no decimals", () => {
    expect(formatMoney("en-US", m(1000, JPY))).toBe("¥1,000");
  });

  it("renders a three-decimal currency with three", () => {
    expect(formatMoney("en-US", m(1234, KWD))).toContain("1.234");
  });

  it("renders zero", () => {
    expect(formatMoney("en-US", zero(USD))).toBe("$0.00");
  });
});
