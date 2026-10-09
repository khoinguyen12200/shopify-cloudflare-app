import { and, asc, count, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { shops, shopifySyncCheckpoints } from "~/db/schema";
import { getDb } from "~/request-context.server";

/**
 * Per-shop bookkeeping for the uninstall probe, kept in `shopify_sync_checkpoints` (no migration needed):
 * `name = uninstall_probe:{shop}`, `lastSucceededAt` = last completed probe, `lastFailedAt`/`failureCode` = last
 * failed attempt, and `watermarkAt` = the lease expiry while a probe is running (null when idle). The name embeds the
 * shop, so `TenantPurgeRepo` deletes it with the rest of the shop's data.
 */
const checkpointName = (shop: string) => `uninstall_probe:${shop}`;

/** Installed, not probed within the cooldown, no live lease: the one definition of "due" for listing and counting. */
function dueWhere(now: number, cooldownMs: number) {
  const probe = shopifySyncCheckpoints;
  return and(
    isNull(shops.uninstalledAt),
    or(isNull(probe.lastSucceededAt), lt(probe.lastSucceededAt, now - cooldownMs)),
    or(isNull(probe.watermarkAt), lte(probe.watermarkAt, now)),
  );
}

export class ShopTokenProbeRepo {
  /**
   * Installed shops whose probe is due, least-recently-attempted first, in ONE query. A shop with a live lease or a
   * probe that completed within `cooldownMs` is excluded. Ordering by the last attempt of either kind means a shop
   * that keeps failing cannot starve the others.
   */
  async listDue(now: number, cooldownMs: number, limit: number): Promise<string[]> {
    const probe = shopifySyncCheckpoints;
    const lastAttempt = sql<number>`max(coalesce(${probe.lastSucceededAt}, 0), coalesce(${probe.lastFailedAt}, 0))`;
    const rows = await getDb()
      .select({ shop: shops.shop })
      .from(shops)
      .leftJoin(probe, eq(probe.name, sql`'uninstall_probe:' || ${shops.shop}`))
      .where(dueWhere(now, cooldownMs))
      .orderBy(asc(lastAttempt), asc(shops.shop))
      .limit(limit);
    return rows.map((row) => row.shop);
  }

  /** How many shops are due right now - the backlog behind `listDue`'s batch. A count only; no shop is named. */
  async countDue(now: number, cooldownMs: number): Promise<number> {
    const probe = shopifySyncCheckpoints;
    const [row] = await getDb()
      .select({ due: count() })
      .from(shops)
      .leftJoin(probe, eq(probe.name, sql`'uninstall_probe:' || ${shops.shop}`))
      .where(dueWhere(now, cooldownMs));
    return row?.due ?? 0;
  }

  /**
   * Take the shop's probe lease. One statement: the row is created, or an EXPIRED lease is taken over, and a live
   * lease makes the conflict clause match nothing — so two concurrent ticks can never both get `true`.
   */
  async acquireLease(shop: string, now: number, leaseMs: number): Promise<boolean> {
    const taken = await getDb()
      .insert(shopifySyncCheckpoints)
      .values({ name: checkpointName(shop), watermarkAt: now + leaseMs })
      .onConflictDoUpdate({
        target: shopifySyncCheckpoints.name,
        set: { watermarkAt: now + leaseMs },
        where: or(isNull(shopifySyncCheckpoints.watermarkAt), lte(shopifySyncCheckpoints.watermarkAt, now)),
      })
      .returning({ name: shopifySyncCheckpoints.name });
    return taken.length === 1;
  }

  /** End the probe and free the lease, recording how it went. */
  async release(shop: string, result: { readonly at: number } & ({ readonly succeeded: true } | { readonly succeeded: false; readonly code: string; readonly detail: string })): Promise<void> {
    const outcome = result.succeeded
      ? { lastSucceededAt: result.at, lastFailedAt: null, failureCode: null, failureDetail: null }
      : { lastFailedAt: result.at, failureCode: result.code, failureDetail: result.detail.slice(0, 1000) };
    await getDb()
      .update(shopifySyncCheckpoints)
      .set({ watermarkAt: null, ...outcome })
      .where(eq(shopifySyncCheckpoints.name, checkpointName(shop)));
  }
}
