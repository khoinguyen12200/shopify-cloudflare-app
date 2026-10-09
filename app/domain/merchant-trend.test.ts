import { describe, it, expect } from "vitest";
import { assembleTrend, trendWindows } from "./merchant-trend";

/** Anchor: 15 Aug 2026, so a 12-month window runs Sep 2025 → Aug 2026. */
const NOW = Date.parse("2026-08-15T12:00:00.000Z");
const at = (iso: string) => Date.parse(iso);

describe("trendWindows", () => {
  it("returns exactly the requested number of months, oldest first", () => {
    // A month with no movement must still appear, or the chart silently
    // compresses time and a flat stretch reads as continuous growth.
    const windows = trendWindows(12, NOW);
    expect(windows).toHaveLength(12);
    expect(windows[0]?.month).toBe("Sep");
    expect(windows.at(-1)?.month).toBe("Aug");
  });

  it("makes each month a half-open interval that butts against the next", () => {
    const windows = trendWindows(3, NOW);
    expect(windows.map((w) => w.month)).toEqual(["Jun", "Jul", "Aug"]);
    expect(windows[0]).toMatchObject({ start: at("2026-06-01T00:00:00.000Z"), end: at("2026-07-01T00:00:00.000Z") });
    expect(windows[1]?.start).toBe(windows[0]?.end);
    expect(windows[2]?.end).toBe(at("2026-09-01T00:00:00.000Z"));
  });

  it("crosses a year boundary", () => {
    const windows = trendWindows(3, at("2026-01-10T00:00:00.000Z"));
    expect(windows.map((w) => w.month)).toEqual(["Nov", "Dec", "Jan"]);
    expect(windows[0]?.start).toBe(at("2025-11-01T00:00:00.000Z"));
  });

  it("returns nothing for zero months", () => {
    expect(trendWindows(0, NOW)).toEqual([]);
  });
});

describe("assembleTrend", () => {
  it("pairs each window with its counts, in order", () => {
    const windows = trendWindows(2, NOW);
    expect(
      assembleTrend(windows, [
        { installs: 2, uninstalls: 1, active: 5 },
        { installs: 0, uninstalls: 0, active: 5 },
      ]),
    ).toEqual([
      { month: "Jul", installs: 2, uninstalls: 1, active: 5 },
      { month: "Aug", installs: 0, uninstalls: 0, active: 5 },
    ]);
  });

  it("reports zeros for a window the database returned no counts for", () => {
    expect(assembleTrend(trendWindows(1, NOW), [])).toEqual([
      { month: "Aug", installs: 0, uninstalls: 0, active: 0 },
    ]);
  });
});
