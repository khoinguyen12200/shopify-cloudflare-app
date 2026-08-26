/**
 * The three merchant numbers the internal dashboard charts, in one pass over
 * the shops table.
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
 * and invents a growth story that did not happen.
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

export interface TrendShop {
  readonly installedAt: number;
  readonly uninstalledAt: number | null;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en", { month: "short" });

export function merchantTrend(
  shops: readonly TrendShop[],
  months: number,
  now: number,
): MerchantMonth[] {
  const anchor = new Date(now);
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();

  return Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    const start = Date.UTC(anchorYear, anchorMonth - offset, 1);
    // The first instant of the NEXT month, so "in this month" is a half-open
    // interval and the last millisecond of the month is never lost to rounding.
    const end = Date.UTC(anchorYear, anchorMonth - offset + 1, 1);

    let installs = 0;
    let uninstalls = 0;
    let active = 0;

    for (const shop of shops) {
      if (shop.installedAt >= start && shop.installedAt < end) installs += 1;

      if (
        shop.uninstalledAt !== null &&
        shop.uninstalledAt >= start &&
        shop.uninstalledAt < end
      ) {
        uninstalls += 1;
      }

      // Installed by the end of this month and not gone before it.
      const arrived = shop.installedAt < end;
      const stillHere = shop.uninstalledAt === null || shop.uninstalledAt >= end;
      if (arrived && stillHere) active += 1;
    }

    return {
      month: MONTH_LABEL.format(new Date(start)),
      installs,
      uninstalls,
      active,
    };
  });
}
