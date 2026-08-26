/**
 * The order to try a purpose's models in, given what the runtime knows about
 * their health.
 *
 * PURE, so every branch of the fallback policy is provable without a database
 * or a model. The I/O — reading the rows, writing health back — is the
 * repository's job.
 *
 * Two rules carry the whole design:
 *
 * **A recently failed model is DEMOTED, never dropped.** Dropping could empty a
 * purpose entirely, and then one flaky model takes the feature down with it. At
 * the back of its own chain it is only reached when everything better has
 * already failed, which is exactly when a degraded answer beats no answer.
 *
 * **Disabled IS a removal**, because that one is a person's deliberate choice
 * rather than the runtime's guess.
 */

/** How long a failed model stays demoted before it is trusted at its own priority again. */
export const MODEL_RECOVERY_MS = 15 * 60_000;

export interface ChainRow {
  readonly modelId: string;
  /** Ascending. 0 is tried first. */
  readonly priority: number;
  readonly enabled: boolean;
  readonly healthy: boolean;
  readonly lastFailedAt: number | null;
}

/**
 * Whether a model is inside its recovery window.
 *
 * A row marked unhealthy with no failure time is NOT demoted: there is nothing
 * to measure a window from, and the alternative sidelines it forever.
 */
export function isDemoted(row: ChainRow, now: number): boolean {
  if (row.healthy) return false;
  if (row.lastFailedAt === null) return false;
  return now - row.lastFailedAt < MODEL_RECOVERY_MS;
}

export function orderChain(rows: readonly ChainRow[], now: number): string[] {
  const usable = rows.filter((row) => row.enabled);
  const byPriority = [...usable].sort((a, b) => a.priority - b.priority);

  // Two passes rather than one comparator, so priority order is preserved
  // WITHIN each group as well as between them.
  const healthy = byPriority.filter((row) => !isDemoted(row, now));
  const demoted = byPriority.filter((row) => isDemoted(row, now));

  return [...healthy, ...demoted].map((row) => row.modelId);
}
