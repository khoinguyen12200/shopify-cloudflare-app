import { and, desc, eq, ne, or, sql, exists } from "drizzle-orm";
import type { SubscriptionStatus, SubscriptionObservation } from "~/domain/subscription-lifecycle";
import { shopSubscriptionItems, shopSubscriptions } from "~/db/schema";
import { getDb } from "~/request-context.server";

export interface SubscriptionCacheInvalidator { invalidate(shop: string): Promise<void>; }

export type SubscriptionObservationInput = SubscriptionObservation & {
  readonly subscriptionId: string;
  readonly planHandle?: string | null;
  readonly billingInterval?: string | null;
  readonly trialEndsAt?: number | null;
  readonly currentPeriodStartsAt?: number | null;
  readonly currentPeriodEndsAt?: number | null;
  readonly cancellationEffectiveAt?: number | null;
  readonly cancelEffectiveOn?: string | null;
  readonly pendingPlanHandle?: string | null;
  readonly pendingBillingInterval?: string | null;
  readonly pendingLegacySubscriptionId?: string | null;
  readonly items?: readonly {
    readonly itemType: string;
    readonly priceAmount?: number | null;
    readonly priceCurrency?: string | null;
    readonly cappedAmountAmount?: number | null;
    readonly cappedAmountCurrency?: string | null;
  }[];
};

export interface CurrentSubscriptionProjection {
  readonly shop: string;
  readonly status: SubscriptionStatus;
  readonly billingInterval: string | null;
  readonly priceAmount: number | null;
  readonly priceCurrency: string | null;
  readonly planHandle: string | null;
  readonly trialEndsAt: number | null;
  readonly currentPeriodEndsAt: number | null;
  readonly currentPeriodStartsAt: number | null;
  readonly cancellationEffectiveAt: number | null;
  readonly revision: number;
}

const statusByKind: Record<string, SubscriptionStatus> = {
  none: "NONE", pending: "PENDING", active: "ACTIVE", cancellation_scheduled: "CANCELLATION_SCHEDULED",
  frozen: "FROZEN", canceled: "CANCELED", unknown: "UNKNOWN",
};
const kindByStatus: Record<SubscriptionStatus, "none" | "pending" | "active" | "cancellation_scheduled" | "frozen" | "canceled" | "unknown"> = {
  NONE: "none", PENDING: "pending", ACTIVE: "active", CANCELLATION_SCHEDULED: "cancellation_scheduled", FROZEN: "frozen", CANCELED: "canceled", UNKNOWN: "unknown",
};

export class ShopSubscriptionRepo {
  constructor(private readonly cache?: SubscriptionCacheInvalidator) {}
  async currentForShop(shop: string): Promise<CurrentSubscriptionProjection | undefined> {
    const rows = await getDb().select({
      shop: shopSubscriptions.shop,
      status: shopSubscriptions.status,
      billingInterval: shopSubscriptions.billingInterval,
      planHandle: shopSubscriptions.planHandle,
      priceAmount: shopSubscriptionItems.priceAmount,
      priceCurrency: shopSubscriptionItems.priceCurrency,
      trialEndsAt: shopSubscriptions.trialEndsAt,
      currentPeriodEndsAt: shopSubscriptions.currentPeriodEndsAt,
      currentPeriodStartsAt: shopSubscriptions.currentPeriodStartsAt,
      cancellationEffectiveAt: shopSubscriptions.cancellationEffectiveAt,
      revision: shopSubscriptions.revision,
    }).from(shopSubscriptions).leftJoin(shopSubscriptionItems, and(
      eq(shopSubscriptionItems.shop, shopSubscriptions.shop),
      eq(shopSubscriptionItems.subscriptionId, shopSubscriptions.subscriptionId),
    )).where(eq(shopSubscriptions.shop, shop)).orderBy(desc(shopSubscriptions.appliedOccurredAt), desc(shopSubscriptions.appliedExternalId), shopSubscriptionItems.position);
    return rows[0];
  }

  async listCurrent(): Promise<CurrentSubscriptionProjection[]> {
    const rows = await getDb().select({
      shop: shopSubscriptions.shop,
      status: shopSubscriptions.status,
      billingInterval: shopSubscriptions.billingInterval,
      planHandle: shopSubscriptions.planHandle,
      priceAmount: shopSubscriptionItems.priceAmount,
      priceCurrency: shopSubscriptionItems.priceCurrency,
      trialEndsAt: shopSubscriptions.trialEndsAt,
      currentPeriodEndsAt: shopSubscriptions.currentPeriodEndsAt,
      currentPeriodStartsAt: shopSubscriptions.currentPeriodStartsAt,
      cancellationEffectiveAt: shopSubscriptions.cancellationEffectiveAt,
      revision: shopSubscriptions.revision,
    }).from(shopSubscriptions).leftJoin(shopSubscriptionItems, and(
      eq(shopSubscriptionItems.shop, shopSubscriptions.shop),
      eq(shopSubscriptionItems.subscriptionId, shopSubscriptions.subscriptionId),
    )).orderBy(shopSubscriptionItems.position);
    return rows;
  }

  async get(shop: string, subscriptionId: string) {
    const [row] = await getDb().select().from(shopSubscriptions).where(and(eq(shopSubscriptions.shop, shop), eq(shopSubscriptions.subscriptionId, subscriptionId))).limit(1);
    return row;
  }

  async list(shop: string) {
    return getDb().select().from(shopSubscriptions).where(eq(shopSubscriptions.shop, shop));
  }

  async upsertObservation(shop: string, observation: SubscriptionObservationInput): Promise<"applied" | "stale" | "duplicate"> {
    const db = getDb();
    const current = await this.get(shop, observation.subscriptionId);
    const duplicate = current && observation.occurredAt === current.appliedOccurredAt && observation.externalId === current.appliedExternalId;
    const stale = current && (observation.occurredAt < current.appliedOccurredAt || (observation.occurredAt === current.appliedOccurredAt && observation.externalId < current.appliedExternalId));
    if (stale) return "stale";
    const { applySubscriptionObservation } = await import("~/domain/subscription-lifecycle");
    const state = applySubscriptionObservation(current ? { kind: kindByStatus[current.status], occurredAt: current.appliedOccurredAt, externalId: current.appliedExternalId } : null, observation);
    const changed = !current || statusByKind[state.kind] !== current.status ||
      (observation.planHandle !== undefined && observation.planHandle !== current.planHandle) ||
      (observation.billingInterval !== undefined && observation.billingInterval !== current.billingInterval) ||
      (observation.currentPeriodEndsAt !== undefined && observation.currentPeriodEndsAt !== current.currentPeriodEndsAt) ||
      (observation.cancellationEffectiveAt !== undefined && observation.cancellationEffectiveAt !== current.cancellationEffectiveAt) ||
      (observation.cancelEffectiveOn !== undefined && observation.cancelEffectiveOn !== current.cancelEffectiveOn);
    const nextRevision = changed ? (current?.revision ?? 0) + 1 : (current?.revision ?? 1);
    const parentProjection = db.insert(shopSubscriptions).values({
      shop, subscriptionId: observation.subscriptionId, status: statusByKind[state.kind],
      planHandle: observation.planHandle === undefined ? current?.planHandle ?? null : observation.planHandle,
      billingInterval: observation.billingInterval === undefined ? current?.billingInterval ?? null : observation.billingInterval,
      trialEndsAt: observation.trialEndsAt === undefined ? current?.trialEndsAt ?? null : observation.trialEndsAt,
      currentPeriodStartsAt: observation.currentPeriodStartsAt === undefined ? current?.currentPeriodStartsAt ?? null : observation.currentPeriodStartsAt,
      currentPeriodEndsAt: observation.currentPeriodEndsAt === undefined ? current?.currentPeriodEndsAt ?? null : observation.currentPeriodEndsAt,
      cancelEffectiveOn: observation.cancelEffectiveOn === undefined ? current?.cancelEffectiveOn ?? null : observation.cancelEffectiveOn,
      cancellationEffectiveAt: observation.cancellationEffectiveAt === undefined ? current?.cancellationEffectiveAt ?? null : observation.cancellationEffectiveAt,
      pendingPlanHandle: observation.pendingPlanHandle === undefined ? current?.pendingPlanHandle ?? null : observation.pendingPlanHandle,
      pendingBillingInterval: observation.pendingBillingInterval === undefined ? current?.pendingBillingInterval ?? null : observation.pendingBillingInterval,
      pendingLegacySubscriptionId: observation.pendingLegacySubscriptionId === undefined ? current?.pendingLegacySubscriptionId ?? null : observation.pendingLegacySubscriptionId,
      appliedOccurredAt: observation.occurredAt, appliedExternalId: observation.externalId,
      revision: nextRevision,
    }).onConflictDoUpdate({ target: [shopSubscriptions.shop, shopSubscriptions.subscriptionId], set: {
      status: statusByKind[state.kind],
      planHandle: observation.planHandle === undefined ? current?.planHandle ?? null : observation.planHandle,
      billingInterval: observation.billingInterval === undefined ? current?.billingInterval ?? null : observation.billingInterval,
      trialEndsAt: observation.trialEndsAt === undefined ? current?.trialEndsAt ?? null : observation.trialEndsAt,
      currentPeriodStartsAt: observation.currentPeriodStartsAt === undefined ? current?.currentPeriodStartsAt ?? null : observation.currentPeriodStartsAt,
      currentPeriodEndsAt: observation.currentPeriodEndsAt === undefined ? current?.currentPeriodEndsAt ?? null : observation.currentPeriodEndsAt,
      cancelEffectiveOn: observation.cancelEffectiveOn === undefined ? current?.cancelEffectiveOn ?? null : observation.cancelEffectiveOn,
      cancellationEffectiveAt: observation.cancellationEffectiveAt === undefined ? current?.cancellationEffectiveAt ?? null : observation.cancellationEffectiveAt,
      pendingPlanHandle: observation.pendingPlanHandle === undefined ? current?.pendingPlanHandle ?? null : observation.pendingPlanHandle,
      pendingBillingInterval: observation.pendingBillingInterval === undefined ? current?.pendingBillingInterval ?? null : observation.pendingBillingInterval,
      pendingLegacySubscriptionId: observation.pendingLegacySubscriptionId === undefined ? current?.pendingLegacySubscriptionId ?? null : observation.pendingLegacySubscriptionId,
      appliedOccurredAt: observation.occurredAt, appliedExternalId: observation.externalId,
      revision: changed ? sql`${shopSubscriptions.revision} + 1` : shopSubscriptions.revision,
    }, where: or(sql`${shopSubscriptions.appliedOccurredAt} < ${observation.occurredAt}`, and(eq(shopSubscriptions.appliedOccurredAt, observation.occurredAt), sql`${shopSubscriptions.appliedExternalId} < ${observation.externalId}`)) }).returning({ subscriptionId: shopSubscriptions.subscriptionId });
    const matchingProjection = exists(db.select({ shop: shopSubscriptions.shop }).from(shopSubscriptions).where(and(eq(shopSubscriptions.shop, shop), eq(shopSubscriptions.subscriptionId, observation.subscriptionId), eq(shopSubscriptions.appliedOccurredAt, observation.occurredAt), eq(shopSubscriptions.appliedExternalId, observation.externalId))));
    const projectionScope = and(eq(shopSubscriptions.shop, shop), eq(shopSubscriptions.subscriptionId, observation.subscriptionId), eq(shopSubscriptions.appliedOccurredAt, observation.occurredAt), eq(shopSubscriptions.appliedExternalId, observation.externalId));
    const itemReplacement = observation.items ? [
      db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, shop), eq(shopSubscriptionItems.subscriptionId, observation.subscriptionId), matchingProjection)),
      ...observation.items.map((item, position) => db.insert(shopSubscriptionItems).select(db.select({
        shop: shopSubscriptions.shop, subscriptionId: shopSubscriptions.subscriptionId,
        position: sql<number>`${position}`.as("position"), itemType: sql<string>`${item.itemType}`.as("item_type"),
        priceAmount: sql<number | null>`${item.priceAmount ?? null}`.as("price_amount"), priceCurrency: sql<string | null>`${item.priceCurrency ?? null}`.as("price_currency"),
        cappedAmountAmount: sql<number | null>`${item.cappedAmountAmount ?? null}`.as("capped_amount_amount"), cappedAmountCurrency: sql<string | null>`${item.cappedAmountCurrency ?? null}`.as("capped_amount_currency"),
      }).from(shopSubscriptions).where(projectionScope))),
    ] : [];
    const [applied] = await db.batch([parentProjection, ...itemReplacement]);
    if (applied.length === 0 && !duplicate) return "stale";
    await db.batch([
      db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, shop), ne(shopSubscriptionItems.subscriptionId, observation.subscriptionId))),
      db.delete(shopSubscriptions).where(and(eq(shopSubscriptions.shop, shop), ne(shopSubscriptions.subscriptionId, observation.subscriptionId))),
    ]);
    if (this.cache && (duplicate || applied.length > 0)) {
      try {
        await this.cache.invalidate(shop);
      } catch (error) {
        console.error(JSON.stringify({
          event: "entitlements.cache_invalidation_failed",
          shop,
          error: error instanceof Error ? error.message : "unknown",
        }));
      }
    }
    return duplicate ? "duplicate" : "applied";
  }

  async upsertSubscriptionProjection(shop: string, observation: SubscriptionObservationInput): Promise<"applied" | "stale" | "duplicate"> {
    return this.upsertObservation(shop, observation);
  }
}
