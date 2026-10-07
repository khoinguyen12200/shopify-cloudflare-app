export interface RawUninstallFeedback {
  readonly eventId: string;
  readonly shop: string;
  readonly shopName: string | null;
  readonly logoUrl: string | null;
  readonly occurredAt: number;
  readonly reason: string | null;
  readonly reasonDescription: string | null;
}

export interface ReasonCount {
  readonly reason: string;
  readonly label: string;
  readonly count: number;
  readonly percentage: number;
}

/**
 * Convert snake_case or SCREAMING_SNAKE_CASE reason identifiers to clean title case.
 * e.g. "TOO_EXPENSIVE" -> "Too Expensive"
 */
export function formatReason(reason: string | null): string {
  if (!reason || reason.trim().length === 0) return "Unspecified";
  return reason
    .trim()
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Group and sort uninstall reasons by frequency.
 */
export function aggregateUninstallReasons(
  items: readonly { readonly reason: string | null }[],
): readonly ReasonCount[] {
  const counts = new Map<string, number>();
  let totalWithReason = 0;

  for (const item of items) {
    if (item.reason && item.reason.trim().length > 0) {
      const key = item.reason.trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      totalWithReason += 1;
    }
  }

  if (totalWithReason === 0) return [];

  return Array.from(counts.entries())
    .map(([reason, count]) => ({
      reason,
      label: formatReason(reason),
      count,
      percentage: Math.round((count / totalWithReason) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Filter feedback items where the merchant actually wrote comments/description.
 */
export function filterMerchantFeedback<
  T extends { readonly reasonDescription: string | null },
>(items: readonly T[]): readonly T[] {
  return items.filter(
    (item) => item.reasonDescription !== null && item.reasonDescription.trim().length > 0,
  );
}
