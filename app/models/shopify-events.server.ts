import { and, desc, eq, or, sql } from "drizzle-orm";
import type { RelationshipEventType } from "~/domain/shop-lifecycle";
import {
  shopifyEvents,
  shopifyRelationshipEvents,
  shopifySubscriptionEvents,
  shopSubscriptionItems,
  shopSubscriptions,
  shops,
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

export interface PartnerSubscriptionEvent {
  readonly id: string;
  readonly shop: string;
  readonly shopifyShopId: string;
  readonly subscriptionId: string;
  readonly type: "CREATED" | "UPDATED" | "CANCELLATION_SCHEDULED" | "CANCELED" | "FROZEN" | "UNFROZEN";
  readonly status: import("~/domain/subscription-lifecycle").SubscriptionStatus;
  readonly occurredAt: number;
  readonly synchronizedAt: number;
  readonly planHandle?: string | null;
  readonly billingInterval?: string | null;
  readonly trialEndsAt?: number | null;
  readonly currentPeriodEndsAt?: number | null;
  readonly cancellationEffectiveAt?: number | null;
  readonly price?: { readonly amount: number | null; readonly currency: string | null };
  readonly items?: readonly { readonly itemType: string; readonly priceAmount?: number | null; readonly priceCurrency?: string | null; readonly cappedAmountAmount?: number | null; readonly cappedAmountCurrency?: string | null }[];
}

/**
 * The sole D1 adapter for Shopify's immutable business-event history.
 * `partner_history` is part of the composite key because event identity is
 * guaranteed within the source that issued it.
 */
export class ShopifyEventRepo {
  async recordAndProject(event: PartnerRelationshipEvent | PartnerSubscriptionEvent): Promise<"inserted" | "duplicate"> {
    return "subscriptionId" in event ? this.recordPartnerSubscription(event) : this.recordPartnerRelationship(event);
  }

  async upsertRelationshipProjection(event: PartnerRelationshipEvent): Promise<"applied" | "stale" | "duplicate"> {
    const result = await this.recordPartnerRelationship(event);
    return result === "inserted" ? "applied" : "duplicate";
  }

  async upsertSubscriptionProjection(event: PartnerSubscriptionEvent): Promise<"applied" | "stale" | "duplicate"> {
    const result = await this.recordPartnerSubscription(event);
    return result === "inserted" ? "applied" : "duplicate";
  }
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

  async recordPartnerRelationship(event: PartnerRelationshipEvent): Promise<"inserted" | "duplicate"> {
    const db = getDb();
    const status = event.type;
    const operational = event.type === "INSTALLED" || event.type === "REACTIVATED";
    const [inserted] = await db.batch([
      db.insert(shopifyEvents).values({ source: "partner_history", eventId: event.id, eventType: event.type, shop: event.shop, shopifyShopId: event.shopifyShopId, occurredAt: event.occurredAt, synchronizedAt: event.synchronizedAt }).onConflictDoNothing().returning({ eventId: shopifyEvents.eventId }),
      db.insert(shopifyRelationshipEvents).values({ eventSource: "partner_history", eventId: event.id, reason: event.reason, reasonDescription: event.reasonDescription }).onConflictDoNothing(),
      db.insert(shops).values({ shop: event.shop, shopifyShopId: event.shopifyShopId, installedAt: event.occurredAt, currentInstalledAt: operational ? event.occurredAt : null, uninstalledAt: operational ? null : event.occurredAt, relationshipStatus: status, relationshipOccurredAt: event.occurredAt, relationshipExternalId: event.id }).onConflictDoUpdate({ target: shops.shop, set: { shopifyShopId: event.shopifyShopId, relationshipStatus: status, relationshipOccurredAt: event.occurredAt, relationshipExternalId: event.id, currentInstalledAt: operational ? event.occurredAt : null, uninstalledAt: operational ? null : event.occurredAt }, where: or(sql`${shops.relationshipOccurredAt} IS NULL`, sql`${shops.relationshipOccurredAt} < ${event.occurredAt}`, and(eq(shops.relationshipOccurredAt, event.occurredAt), sql`${shops.relationshipExternalId} < ${event.id}`)) }).returning({ shop: shops.shop }),
    ]);
    if (event.type === "INSTALLED") await db.update(shops).set({ installedAt: sql`min(${shops.installedAt}, ${event.occurredAt})` }).where(eq(shops.shop, event.shop));
    return inserted.length ? "inserted" : "duplicate";
  }

  async recordPartnerSubscription(event: PartnerSubscriptionEvent): Promise<"inserted" | "duplicate"> {
    const db = getDb();
    const status = event.status;
    const [inserted] = await db.batch([
      db.insert(shopifyEvents).values({
        source: "partner_history", eventId: event.id, eventType: event.type,
        shop: event.shop, shopifyShopId: event.shopifyShopId,
        occurredAt: event.occurredAt, synchronizedAt: event.synchronizedAt,
      }).onConflictDoNothing().returning({ eventId: shopifyEvents.eventId }),
      db.insert(shopifySubscriptionEvents).values({
        eventSource: "partner_history", eventId: event.id, subscriptionId: event.subscriptionId,
        status, planHandle: event.planHandle ?? null,
        billingInterval: event.billingInterval ?? null, trialEndsAt: event.trialEndsAt ?? null,
        currentPeriodEndsAt: event.currentPeriodEndsAt ?? null,
        cancellationEffectiveAt: event.cancellationEffectiveAt ?? null,
        priceAmount: event.price?.amount ?? null, priceCurrency: event.price?.currency ?? null,
      }).onConflictDoNothing(),
      db.insert(shopSubscriptions).values({ shop: event.shop, subscriptionId: event.subscriptionId, status, planHandle: event.planHandle ?? null, billingInterval: event.billingInterval ?? null, trialEndsAt: event.trialEndsAt ?? null, currentPeriodEndsAt: event.currentPeriodEndsAt ?? null, cancellationEffectiveAt: event.cancellationEffectiveAt ?? null, appliedOccurredAt: event.occurredAt, appliedExternalId: event.id }).onConflictDoUpdate({ target: [shopSubscriptions.shop, shopSubscriptions.subscriptionId], set: { status, planHandle: event.planHandle ?? null, billingInterval: event.billingInterval ?? null, trialEndsAt: event.trialEndsAt ?? null, currentPeriodEndsAt: event.currentPeriodEndsAt ?? null, cancellationEffectiveAt: event.cancellationEffectiveAt ?? null, appliedOccurredAt: event.occurredAt, appliedExternalId: event.id }, where: or(sql`${shopSubscriptions.appliedOccurredAt} < ${event.occurredAt}`, and(eq(shopSubscriptions.appliedOccurredAt, event.occurredAt), sql`${shopSubscriptions.appliedExternalId} < ${event.id}`)) }).returning({ subscriptionId: shopSubscriptions.subscriptionId }),
    ]);
    if (inserted.length === 1 && event.items) {
      await db.batch([db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, event.shop), eq(shopSubscriptionItems.subscriptionId, event.subscriptionId))), ...(event.items.length ? [db.insert(shopSubscriptionItems).values(event.items.map((item, position) => ({ shop: event.shop, subscriptionId: event.subscriptionId, position, itemType: item.itemType, priceAmount: item.priceAmount ?? null, priceCurrency: item.priceCurrency ?? null, cappedAmountAmount: item.cappedAmountAmount ?? null, cappedAmountCurrency: item.cappedAmountCurrency ?? null })))] : [])]);
    }
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
