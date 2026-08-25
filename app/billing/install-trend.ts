export interface MonthlyInstalls {
  /** Short month label — "Jan", "Feb"... Internal-console-only, so unlocalized. */
  readonly month: string;
  readonly count: number;
}

const MONTH_LABEL = new Intl.DateTimeFormat("en", { month: "short" });

/**
 * New installs per calendar month, oldest first, for the `months` window
 * ending on the month containing `now`. Always returns exactly `months`
 * buckets, even ones with zero installs, so a chart never silently drops an
 * empty month.
 */
export function installsByMonth(
  shops: readonly { installedAt: number }[],
  months: number,
  now: number,
): MonthlyInstalls[] {
  const anchor = new Date(now);
  const anchorYear = anchor.getUTCFullYear();
  const anchorMonth = anchor.getUTCMonth();

  const buckets = Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const date = new Date(Date.UTC(anchorYear, anchorMonth - offset, 1));
    return { key: `${date.getUTCFullYear()}-${date.getUTCMonth()}`, month: MONTH_LABEL.format(date), count: 0 };
  });

  const byKey = new Map(buckets.map((b) => [b.key, b]));

  for (const shop of shops) {
    const installed = new Date(shop.installedAt);
    const key = `${installed.getUTCFullYear()}-${installed.getUTCMonth()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }

  return buckets.map(({ month, count }) => ({ month, count }));
}
