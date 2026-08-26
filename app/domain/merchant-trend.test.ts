import { describe, it, expect } from "vitest";
import { merchantTrend } from "./merchant-trend";

/** Anchor: 15 Aug 2026, so a 12-month window runs Sep 2025 → Aug 2026. */
const NOW = Date.parse("2026-08-15T12:00:00.000Z");

const at = (iso: string) => Date.parse(iso);

const shop = (installed: string, uninstalled?: string) => ({
  installedAt: at(installed),
  uninstalledAt: uninstalled === undefined ? null : at(uninstalled),
});

describe("the merchant trend", () => {
  it("returns exactly the requested number of buckets, oldest first", () => {
    // A month with no movement must still appear, or the chart silently
    // compresses time and a flat stretch reads as continuous growth.
    const trend = merchantTrend([], 12, NOW);

    expect(trend).toHaveLength(12);
    expect(trend[0]?.month).toBe("Sep");
    expect(trend.at(-1)?.month).toBe("Aug");
  });

  it("reports zero everywhere when no shop has ever installed", () => {
    const trend = merchantTrend([], 3, NOW);
    expect(trend).toEqual([
      { month: "Jun", installs: 0, uninstalls: 0, active: 0 },
      { month: "Jul", installs: 0, uninstalls: 0, active: 0 },
      { month: "Aug", installs: 0, uninstalls: 0, active: 0 },
    ]);
  });

  it("counts an install in the month it happened", () => {
    const trend = merchantTrend([shop("2026-07-04T00:00:00.000Z")], 3, NOW);
    expect(trend.map((b) => b.installs)).toEqual([0, 1, 0]);
  });

  it("counts an uninstall in the month it happened, not the month it installed", () => {
    const trend = merchantTrend(
      [shop("2026-06-01T00:00:00.000Z", "2026-08-02T00:00:00.000Z")],
      3,
      NOW,
    );
    expect(trend.map((b) => b.installs)).toEqual([1, 0, 0]);
    expect(trend.map((b) => b.uninstalls)).toEqual([0, 0, 1]);
  });

  it("carries active shops forward — growth is cumulative, not per-month installs", () => {
    // The whole point of the growth chart: one install in June is still a
    // merchant in August. A per-month count would show a cliff.
    const trend = merchantTrend([shop("2026-06-10T00:00:00.000Z")], 3, NOW);
    expect(trend.map((b) => b.active)).toEqual([1, 1, 1]);
  });

  it("drops a shop out of active from the month it uninstalled", () => {
    const trend = merchantTrend(
      [shop("2026-06-01T00:00:00.000Z", "2026-07-15T00:00:00.000Z")],
      3,
      NOW,
    );
    expect(trend.map((b) => b.active)).toEqual([1, 0, 0]);
  });

  it("counts a shop installed BEFORE the window as active throughout it", () => {
    // Otherwise the chart opens at zero every time and invents a growth story
    // that never happened.
    const trend = merchantTrend([shop("2020-01-01T00:00:00.000Z")], 3, NOW);
    expect(trend.map((b) => b.active)).toEqual([1, 1, 1]);
    expect(trend.map((b) => b.installs)).toEqual([0, 0, 0]);
  });

  it("ignores a shop that uninstalled before the window opened", () => {
    const trend = merchantTrend(
      [shop("2020-01-01T00:00:00.000Z", "2020-06-01T00:00:00.000Z")],
      3,
      NOW,
    );
    expect(trend.map((b) => b.active)).toEqual([0, 0, 0]);
    expect(trend.map((b) => b.uninstalls)).toEqual([0, 0, 0]);
  });

  it("treats a shop that left in the very last millisecond of a month as gone that month", () => {
    // Boundary: `active` is measured at the END of the bucket, and it has to
    // agree with `uninstalls` for the same bucket — see the identity below.
    // Counting them as still active in the month they left would make the
    // growth line contradict the uninstall bar sitting under it.
    const trend = merchantTrend(
      [shop("2026-06-01T00:00:00.000Z", "2026-07-31T23:59:59.999Z")],
      3,
      NOW,
    );
    expect(trend.map((b) => b.uninstalls)).toEqual([0, 1, 0]);
    expect(trend.map((b) => b.active)).toEqual([1, 0, 0]);
  });

  it("keeps growth reconcilable: each month's active = last month's + installs - uninstalls", () => {
    // The property that makes the three charts readable together. If it ever
    // breaks, the headline chart is telling a different story from the two
    // beneath it, and neither can be trusted.
    const trend = merchantTrend(
      [
        shop("2026-05-02T00:00:00.000Z"),
        shop("2026-06-02T00:00:00.000Z"),
        shop("2026-06-20T00:00:00.000Z", "2026-07-09T00:00:00.000Z"),
        shop("2026-07-05T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
        shop("2026-08-09T00:00:00.000Z"),
        shop("2020-01-01T00:00:00.000Z"),
      ],
      6,
      NOW,
    );

    // `slice(1)` pairs each bucket with the one before it without a non-null
    // assertion, which @rules/code-craft.md bans in test code too.
    trend.slice(1).forEach((current, index) => {
      const previous = trend[index];
      expect(previous, "every bucket after the first has a predecessor").toBeDefined();
      expect(current.active, `month ${current.month}`).toBe(
        (previous?.active ?? 0) + current.installs - current.uninstalls,
      );
    });
  });

  it("adds up across many shops", () => {
    const trend = merchantTrend(
      [
        shop("2026-06-02T00:00:00.000Z"),
        shop("2026-06-20T00:00:00.000Z"),
        shop("2026-07-05T00:00:00.000Z", "2026-08-01T00:00:00.000Z"),
        shop("2026-08-09T00:00:00.000Z"),
      ],
      3,
      NOW,
    );

    expect(trend).toEqual([
      { month: "Jun", installs: 2, uninstalls: 0, active: 2 },
      { month: "Jul", installs: 1, uninstalls: 0, active: 3 },
      { month: "Aug", installs: 1, uninstalls: 1, active: 3 },
    ]);
  });

  it("never returns a negative active count", () => {
    const trend = merchantTrend(
      [shop("2026-06-01T00:00:00.000Z", "2026-06-02T00:00:00.000Z")],
      3,
      NOW,
    );
    expect(trend.every((b) => b.active >= 0)).toBe(true);
  });
});
