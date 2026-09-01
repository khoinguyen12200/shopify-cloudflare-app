import { and, desc, eq } from "drizzle-orm";
import type { RelationshipEventType } from "~/domain/shop-lifecycle";
import {
  shopifyEvents,
  shopifyRelationshipEvents,
  shopifySubscriptionEvents,
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
    const { ShopRepo } = await import("./shops.server");
    return new ShopRepo().upsertRelationshipProjection({ ...event, externalId: event.id });
  }

  async upsertSubscriptionProjection(event: PartnerSubscriptionEvent): Promise<"applied" | "stale" | "duplicate"> {
    const { ShopSubscriptionRepo } = await import("./shop-subscriptions.server");
    return new ShopSubscriptionRepo().upsertObservation(event.shop, {
      subscriptionId: event.subscriptionId, type: event.type, status: event.status,
      occurredAt: event.occurredAt, externalId: event.id, planHandle: event.planHandle,
      billingInterval: event.billingInterval, trialEndsAt: event.trialEndsAt,
      currentPeriodEndsAt: event.currentPeriodEndsAt, cancellationEffectiveAt: event.cancellationEffectiveAt,
    });
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
    const result = await this.recordPartnerEvent(event);
    if (result === "inserted") {
      const { ShopRepo } = await import("./shops.server");
      await new ShopRepo().upsertRelationshipProjection({
        ...event,
        externalId: event.id,
        type: event.type,
      });
    }
    return result;
  }

  async recordPartnerSubscription(event: PartnerSubscriptionEvent): Promise<"inserted" | "duplicate"> {
    const db = getDb();
    const [inserted] = await db.batch([
      db.insert(shopifyEvents).values({
        source: "partner_history", eventId: event.id, eventType: event.type,
        shop: event.shop, shopifyShopId: event.shopifyShopId,
        occurredAt: event.occurredAt, synchronizedAt: event.synchronizedAt,
      }).onConflictDoNothing().returning({ eventId: shopifyEvents.eventId }),
      db.insert(shopifySubscriptionEvents).values({
        eventSource: "partner_history", eventId: event.id, subscriptionId: event.subscriptionId,
        status: event.status, planHandle: event.planHandle ?? null,
        billingInterval: event.billingInterval ?? null, trialEndsAt: event.trialEndsAt ?? null,
        currentPeriodEndsAt: event.currentPeriodEndsAt ?? null,
        cancellationEffectiveAt: event.cancellationEffectiveAt ?? null,
        priceAmount: event.price?.amount ?? null, priceCurrency: event.price?.currency ?? null,
      }).onConflictDoNothing(),
    ]);
    if (inserted.length === 1) {
      const { ShopSubscriptionRepo } = await import("./shop-subscriptions.server");
      await new ShopSubscriptionRepo().upsertObservation(event.shop, {
        subscriptionId: event.subscriptionId, type: event.type, status: event.status,
        occurredAt: event.occurredAt, externalId: event.id,
        planHandle: event.planHandle ?? null, billingInterval: event.billingInterval ?? null,
        trialEndsAt: event.trialEndsAt ?? null, currentPeriodEndsAt: event.currentPeriodEndsAt ?? null,
        cancellationEffectiveAt: event.cancellationEffectiveAt ?? null,
      });
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
