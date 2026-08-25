import { describe, it, expect } from "vitest";
import { installsByMonth } from "./install-trend";

// A fixed "now" — 2026-03-15.
const NOW = Date.parse("2026-03-15T00:00:00.000Z");

function installedAt(iso: string): { installedAt: number } {
  return { installedAt: Date.parse(iso) };
}

describe("installsByMonth", () => {
  it("returns one bucket per month, oldest first, for the requested window", () => {
    const buckets = installsByMonth([], 3, NOW);
    expect(buckets.map((b) => b.month)).toEqual(["Jan", "Feb", "Mar"]);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it("counts a shop's install in the month it happened", () => {
    const buckets = installsByMonth(
      [installedAt("2026-02-10T00:00:00.000Z"), installedAt("2026-02-20T00:00:00.000Z")],
      3,
      NOW,
    );
    expect(buckets.find((b) => b.month === "Feb")?.count).toBe(2);
    expect(buckets.find((b) => b.month === "Jan")?.count).toBe(0);
  });

  it("excludes an install from before the requested window", () => {
    const buckets = installsByMonth([installedAt("2025-01-01T00:00:00.000Z")], 3, NOW);
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(0);
  });

  it("includes an install from the current, partial month", () => {
    const buckets = installsByMonth([installedAt("2026-03-01T00:00:00.000Z")], 3, NOW);
    expect(buckets.find((b) => b.month === "Mar")?.count).toBe(1);
  });
});
