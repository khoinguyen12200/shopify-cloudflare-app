import { and, desc, eq } from "drizzle-orm";
import type { RelationshipEventType } from "~/domain/shop-lifecycle";
import {
  shopifyEvents,
  shopifyRelationshipEvents,
} from "~/db/schema";
import { getDb } from "~/request-context.server";

/** A Partner History relationship fact with its typed, relational details. */
export interface PartnerRelationshipEvent {
  readonly id: string;
  readonly shop: string;
  readonly shopifyShopId: string;
  readonly type: RelationshipEventType;
  readonly occurredAt: number;
  readonly synchronizedAt: number;
  readonly reason: string | null;
  readonly reasonDescription: string | null;
}

/**
 * The sole D1 adapter for Shopify's immutable business-event history.
 * `partner_history` is part of the composite key because event identity is
 * guaranteed within the source that issued it.
 */
export class ShopifyEventRepo {
  async recordPartnerEvent(event: PartnerRelationshipEvent): Promise<"inserted" | "duplicate"> {
    const db = getDb();
    const [inserted] = await db.batch([
      db
        .insert(shopifyEvents)
        .values({
          source: "partner_history",
          eventId: event.id,
          eventType: event.type,
          shop: event.shop,
          shopifyShopId: event.shopifyShopId,
          occurredAt: event.occurredAt,
          synchronizedAt: event.synchronizedAt,
        })
        .onConflictDoNothing()
        .returning({ eventId: shopifyEvents.eventId }),
      db.insert(shopifyRelationshipEvents).values({
        eventSource: "partner_history",
        eventId: event.id,
        reason: event.reason,
        reasonDescription: event.reasonDescription,
      }).onConflictDoNothing(),
    ]);
    return inserted.length === 1 ? "inserted" : "duplicate";
  }

  async listRelationshipEvents(shop: string): Promise<
    {
      readonly eventId: string;
      readonly eventType: string;
      readonly occurredAt: number;
      readonly reason: string | null;
      readonly reasonDescription: string | null;
    }[]
  > {
    return getDb()
      .select({
        eventId: shopifyEvents.eventId,
        eventType: shopifyEvents.eventType,
        occurredAt: shopifyEvents.occurredAt,
        reason: shopifyRelationshipEvents.reason,
        reasonDescription: shopifyRelationshipEvents.reasonDescription,
      })
      .from(shopifyEvents)
      .innerJoin(
        shopifyRelationshipEvents,
        and(
          eq(shopifyRelationshipEvents.eventSource, shopifyEvents.source),
          eq(shopifyRelationshipEvents.eventId, shopifyEvents.eventId),
        ),
      )
      .where(
        and(eq(shopifyEvents.shop, shop), eq(shopifyEvents.source, "partner_history")),
      )
      .orderBy(desc(shopifyEvents.occurredAt));
  }
}
