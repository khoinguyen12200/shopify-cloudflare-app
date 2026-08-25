import { desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { shops, type Shop } from "~/db/schema";

/**
 * The ONLY place `shops` is queried. Models are the sole layer that touches
 * Drizzle; every method takes `shop` first so no query can be written that
 * spans tenants.
 */
export class ShopRepo {
  async get(shop: string): Promise<Shop | undefined> {
    const rows = await getDb()
      .select()
      .from(shops)
      .where(eq(shops.shop, shop))
      .limit(1);
    return rows[0];
  }

  /** Idempotent: safe to call on every install and re-install. */
  async recordInstall(shop: string, now: number): Promise<void> {
    await getDb()
      .insert(shops)
      .values({ shop, installedAt: now, uninstalledAt: null })
      .onConflictDoUpdate({
        target: shops.shop,
        set: { uninstalledAt: null },
      });
  }

  async recordUninstall(shop: string, now: number): Promise<void> {
    await getDb()
      .update(shops)
      .set({ uninstalledAt: now })
      .where(eq(shops.shop, shop));
  }

  /** Every shop the app has ever seen, newest install first — the internal console's Shops list. */
  async listAll(): Promise<Shop[]> {
    return getDb().select().from(shops).orderBy(desc(shops.installedAt));
  }

  /** Shops with the app still installed — for the internal dashboard. */
  async countInstalled(): Promise<number> {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(shops)
      .where(isNull(shops.uninstalledAt));
    return Number(row?.count ?? 0);
  }

  /**
   * Erase everything stored for this shop, for the `shop/redact` compliance
   * webhook. Returns how many rows went, so the handler can log a real number
   * instead of claiming success blindly.
   *
   * Add a delete here for EVERY shop-scoped table you introduce. A table you
   * forget is data you told Shopify you had erased.
   */
  async purge(shop: string): Promise<number> {
    const deleted = await getDb()
      .delete(shops)
      .where(eq(shops.shop, shop))
      .returning({ shop: shops.shop });
    return deleted.length;
  }
}
