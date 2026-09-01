import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { shops, type Shop } from "~/db/schema";
import {
  isOperationalRelationship,
  type RelationshipState,
} from "~/domain/shop-lifecycle";

const relationshipStatuses: Record<RelationshipState["kind"], NonNullable<Shop["relationshipStatus"]>> = {
  installed: "INSTALLED",
  uninstalled: "UNINSTALLED",
  deactivated: "DEACTIVATED",
  reactivated: "REACTIVATED",
};

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

  /**
   * Persist a state already resolved by the pure relationship state machine.
   * The SQL conflict condition repeats its deterministic ordering key so two
   * workers cannot let a stale projection overwrite a newer one.
   */
  async applyRelationship(shop: string, transition: RelationshipState): Promise<void> {
    const isOperational = isOperationalRelationship(transition);
    await getDb()
      .insert(shops)
      .values({
        shop,
        installedAt: transition.occurredAt,
        currentInstalledAt: isOperational ? transition.occurredAt : null,
        uninstalledAt: isOperational ? null : transition.occurredAt,
        relationshipStatus: relationshipStatuses[transition.kind],
        relationshipOccurredAt: transition.occurredAt,
        relationshipExternalId: transition.externalId,
      })
      .onConflictDoUpdate({
        target: shops.shop,
        set: {
          currentInstalledAt: isOperational ? transition.occurredAt : null,
          uninstalledAt: isOperational ? null : transition.occurredAt,
          relationshipStatus: relationshipStatuses[transition.kind],
          relationshipOccurredAt: transition.occurredAt,
          relationshipExternalId: transition.externalId,
        },
        where: or(
          isNull(shops.relationshipOccurredAt),
          lt(shops.relationshipOccurredAt, transition.occurredAt),
          and(
            eq(shops.relationshipOccurredAt, transition.occurredAt),
            lt(shops.relationshipExternalId, transition.externalId),
          ),
        ),
      });
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
