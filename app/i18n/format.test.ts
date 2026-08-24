import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatNumber,
  formatMoney,
  formatList,
  formatRelativeTime,
} from "./format";

// These assert that en and es genuinely DIFFER. Translating strings but printing
// dates and numbers the same way is a half-done localisation, and a test that
// only checks en would never notice.
describe("dates differ by locale", () => {
  const date = new Date("2026-02-01T12:00:00Z");

  it("formats the same instant differently", () => {
    const en = formatDate("en", date, { dateStyle: "short" });
    const es = formatDate("es", date, { dateStyle: "short" });
    expect(en).not.toBe(es);
  });

  it("puts the day first in es and the month first in en", () => {
    expect(formatDate("en", date, { dateStyle: "short" })).toMatch(/^2\/1\//);
    expect(formatDate("es", date, { dateStyle: "short" })).toMatch(/^1\/2\//);
  });
});

describe("numbers differ by locale", () => {
  it("swaps the decimal and grouping separators", () => {
    expect(formatNumber("en", 1234.5)).toBe("1,234.5");
    expect(formatNumber("es", 1234.5)).toBe("1234,5");
  });
});

describe("money takes integer minor units", () => {
  it("divides by the currency's real number of decimals", () => {
    // 150 minor units of USD is $1.50 — not $150.
    expect(formatMoney("en", 150, "USD")).toBe("$1.50");
  });

  it("handles a zero-decimal currency without inventing cents", () => {
    // JPY has no minor unit, so 150 minor units is ¥150.
    expect(formatMoney("en", 150, "JPY")).toBe("¥150");
  });

  it("formats the same amount differently per locale", () => {
    expect(formatMoney("en", 150000, "EUR")).not.toBe(
      formatMoney("es", 150000, "EUR"),
    );
  });

  it("handles zero", () => {
    expect(formatMoney("en", 0, "USD")).toBe("$0.00");
  });
});

describe("lists use the locale's conjunction", () => {
  it("uses 'and' in en and 'y' in es", () => {
    expect(formatList("en", ["a", "b", "c"])).toBe("a, b, and c");
    expect(formatList("es", ["a", "b", "c"])).toBe("a, b y c");
  });
});

describe("relative time", () => {
  it("localises the unit", () => {
    expect(formatRelativeTime("en", -3, "day")).toBe("3 days ago");
    expect(formatRelativeTime("es", -3, "day")).toBe("hace 3 días");
  });
});
