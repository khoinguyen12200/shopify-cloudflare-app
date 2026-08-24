import { eq } from "drizzle-orm";
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
}
