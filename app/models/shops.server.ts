import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import {
  shops,
  shopGrantedScopes,
  shopifyEvents,
  shopifyRelationshipEvents,
  shopifySubscriptionEvents,
  shopScopeChangeItems,
  shopScopeChanges,
  shopSubscriptionItems,
  shopSubscriptions,
  type Shop,
  webhookDeliveries,
} from "~/db/schema";
import {
  isOperationalRelationship,
  type RelationshipState,
  applyRelationshipEvent,
} from "~/domain/shop-lifecycle";

export interface RelationshipObservation {
  readonly shop: string;
  readonly shopifyShopId: string;
  readonly type: import("~/domain/shop-lifecycle").RelationshipEventType;
  readonly occurredAt: number;
  readonly externalId: string;
}

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
  async upsertRelationshipProjection(event: RelationshipObservation): Promise<"applied" | "stale" | "duplicate"> {
    const current = await this.get(event.shop);
    if (current?.relationshipOccurredAt !== null && current?.relationshipOccurredAt !== undefined && (event.occurredAt < current.relationshipOccurredAt || (event.occurredAt === current.relationshipOccurredAt && event.externalId <= (current.relationshipExternalId ?? "")))) {
      return event.occurredAt === current.relationshipOccurredAt && event.externalId === current.relationshipExternalId ? "duplicate" : "stale";
    }
    const kindByStatus = { INSTALLED: "installed", UNINSTALLED: "uninstalled", DEACTIVATED: "deactivated", REACTIVATED: "reactivated" } as const;
    const state = applyRelationshipEvent(current?.relationshipStatus ? { kind: kindByStatus[current.relationshipStatus], occurredAt: current.relationshipOccurredAt ?? 0, externalId: current.relationshipExternalId ?? "" } : null, { type: event.type, occurredAt: event.occurredAt, externalId: event.externalId });
    await this.applyRelationship(event.shop, state, event.shopifyShopId);
    return "applied";
  }
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
  async applyRelationship(
    shop: string,
    transition: RelationshipState,
    shopifyShopId: string,
  ): Promise<void> {
    const isOperational = isOperationalRelationship(transition);
    const db = getDb();
    await db
      .insert(shops)
      .values({
        shop,
        shopifyShopId,
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
          shopifyShopId,
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

    // The current relationship is ordered by its latest event, but first
    // installation is historical: a delayed older install must still repair it.
    if (transition.kind === "installed") {
      await db
        .update(shops)
        .set({ installedAt: sql`min(${shops.installedAt}, ${transition.occurredAt})` })
        .where(eq(shops.shop, shop));
    }
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
    const db = getDb();
    const deleted = await db.batch([
      db
        .delete(shopScopeChangeItems)
        .where(sql`exists (
          select 1 from ${shopScopeChanges}
          where ${shopScopeChanges.id} = ${shopScopeChangeItems.scopeChangeId}
            and ${shopScopeChanges.shop} = ${shop}
        )`)
        .returning({ id: shopScopeChangeItems.scopeChangeId }),
      db
        .delete(shopScopeChanges)
        .where(eq(shopScopeChanges.shop, shop))
        .returning({ id: shopScopeChanges.id }),
      db
        .delete(shopSubscriptionItems)
        .where(eq(shopSubscriptionItems.shop, shop))
        .returning({ subscriptionId: shopSubscriptionItems.subscriptionId }),
      db
        .delete(shopSubscriptions)
        .where(eq(shopSubscriptions.shop, shop))
        .returning({ subscriptionId: shopSubscriptions.subscriptionId }),
      db
        .delete(shopifyRelationshipEvents)
        .where(sql`exists (
          select 1 from ${shopifyEvents}
          where ${shopifyEvents.source} = ${shopifyRelationshipEvents.eventSource}
            and ${shopifyEvents.eventId} = ${shopifyRelationshipEvents.eventId}
            and ${shopifyEvents.shop} = ${shop}
        )`)
        .returning({ eventId: shopifyRelationshipEvents.eventId }),
      db
        .delete(shopifySubscriptionEvents)
        .where(sql`exists (
          select 1 from ${shopifyEvents}
          where ${shopifyEvents.source} = ${shopifySubscriptionEvents.eventSource}
            and ${shopifyEvents.eventId} = ${shopifySubscriptionEvents.eventId}
            and ${shopifyEvents.shop} = ${shop}
        )`)
        .returning({ eventId: shopifySubscriptionEvents.eventId }),
      db
        .delete(shopifyEvents)
        .where(eq(shopifyEvents.shop, shop))
        .returning({ eventId: shopifyEvents.eventId }),
      db
        .delete(shopGrantedScopes)
        .where(eq(shopGrantedScopes.shop, shop))
        .returning({ scope: shopGrantedScopes.scope }),
      db
        .delete(webhookDeliveries)
        .where(eq(webhookDeliveries.shop, shop))
        .returning({ id: webhookDeliveries.id }),
      db.delete(shops).where(eq(shops.shop, shop)).returning({ shop: shops.shop }),
    ]);
    return deleted.reduce((total, rows) => total + rows.length, 0);
  }
}
