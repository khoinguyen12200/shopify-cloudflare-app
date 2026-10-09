/**
 * The three merchant numbers the internal dashboard charts. The counting is
 * done by the database (`ShopMetricsRepo.installTrend`) in a single aggregate
 * scan; this module owns the calendar — which months, where each starts and
 * ends — and the assembly of the result.
 *
 * Replaces `installsByMonth`, which answered only "how many installed this
 * month". That is the least useful of the three on its own: a month of five
 * installs reads as growth even when six shops left, and a flat install bar
 * says nothing about how big the install base actually is.
 *
 *   installs   — shops that arrived in that month
 *   uninstalls — shops that left in that month
 *   active     — how many shops were still installed at the END of that month
 *
 * `active` is deliberately a snapshot, not a running total of installs minus
 * uninstalls: it is derived from each shop's own dates, so a shop that
 * installed before the window still counts, and the chart never opens at zero
 * and invents a growth story that did not happen. A month is the half-open
 * interval [start, end), so the last millisecond of a month is never lost.
 *
 * Pure — `now` is a parameter, never `Date.now()` (@rules/code-craft.md).
 */
export interface MerchantMonth {
  /** Short month label — "Jan", "Feb"… Internal-console-only, so unlocalized. */
  readonly month: string;
  readonly installs: number;
  readonly uninstalls: number;
  readonly active: number;
}

export interface TrendWindow {
  readonly month: string;
  /** First instant of the month. */
  readonly start: number;
  /** First instant of the NEXT month. */
  readonly end: number;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });

/** The last `months` calendar months ending with the one containing `now`, oldest first. */
export function trendWindows(months: number, now: number): TrendWindow[] {
  const anchor = new Date(now);
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();

  return Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const start = Date.UTC(anchorYear, anchorMonth - offset, 1);
    const end = Date.UTC(anchorYear, anchorMonth - offset + 1, 1);
    return { month: MONTH_LABEL.format(new Date(start)), start, end };
  });
}

/** Pair each window with its counts (same order, same length). */
export function assembleTrend(
  windows: readonly TrendWindow[],
  counts: readonly { readonly installs: number; readonly uninstalls: number; readonly active: number }[],
): MerchantMonth[] {
  return windows.map((window, index) => ({
    month: window.month,
    installs: counts[index]?.installs ?? 0,
    uninstalls: counts[index]?.uninstalls ?? 0,
    active: counts[index]?.active ?? 0,
  }));
}
