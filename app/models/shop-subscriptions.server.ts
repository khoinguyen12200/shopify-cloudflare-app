import { and, desc, eq, inArray, ne, or, sql, exists } from "drizzle-orm";
import type { SubscriptionStatus, SubscriptionObservation } from "~/domain/subscription-lifecycle";
import { shopSubscriptionItems, shopSubscriptions } from "~/db/schema";
import { getDb } from "~/request-context.server";
import type { Db } from "~/db/client";

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

type SubscriptionRow = typeof shopSubscriptions.$inferSelect;

/** A field the observation carries replaces the stored one; an absent field keeps what is stored. */
function keepOrReplace<T>(observed: T | undefined, stored: T | null | undefined): T | null {
  return observed === undefined ? stored ?? null : observed;
}

/** Whether this observation changes anything a reader can see, so the revision only moves when it should. */
function projectionChanged(observation: SubscriptionObservationInput, current: SubscriptionRow | undefined, status: SubscriptionStatus): boolean {
  return !current || status !== current.status ||
    (observation.planHandle !== undefined && observation.planHandle !== current.planHandle) ||
    (observation.billingInterval !== undefined && observation.billingInterval !== current.billingInterval) ||
    (observation.currentPeriodEndsAt !== undefined && observation.currentPeriodEndsAt !== current.currentPeriodEndsAt) ||
    (observation.cancellationEffectiveAt !== undefined && observation.cancellationEffectiveAt !== current.cancellationEffectiveAt) ||
    (observation.cancelEffectiveOn !== undefined && observation.cancelEffectiveOn !== current.cancelEffectiveOn);
}

/** The projection columns an observation writes: shared by the insert and the conflict update. */
function projectionColumns(observation: SubscriptionObservationInput, current: SubscriptionRow | undefined, status: SubscriptionStatus) {
  return {
    status,
    planHandle: keepOrReplace(observation.planHandle, current?.planHandle),
    billingInterval: keepOrReplace(observation.billingInterval, current?.billingInterval),
    trialEndsAt: keepOrReplace(observation.trialEndsAt, current?.trialEndsAt),
    currentPeriodStartsAt: keepOrReplace(observation.currentPeriodStartsAt, current?.currentPeriodStartsAt),
    currentPeriodEndsAt: keepOrReplace(observation.currentPeriodEndsAt, current?.currentPeriodEndsAt),
    cancelEffectiveOn: keepOrReplace(observation.cancelEffectiveOn, current?.cancelEffectiveOn),
    cancellationEffectiveAt: keepOrReplace(observation.cancellationEffectiveAt, current?.cancellationEffectiveAt),
    pendingPlanHandle: keepOrReplace(observation.pendingPlanHandle, current?.pendingPlanHandle),
    pendingBillingInterval: keepOrReplace(observation.pendingBillingInterval, current?.pendingBillingInterval),
    pendingLegacySubscriptionId: keepOrReplace(observation.pendingLegacySubscriptionId, current?.pendingLegacySubscriptionId),
    appliedOccurredAt: observation.occurredAt,
    appliedExternalId: observation.externalId,
  };
}

/** Statements that replace the line items, guarded so they only apply when this observation's projection won. */
function itemReplacement(db: Db, shop: string, observation: SubscriptionObservationInput) {
  if (!observation.items) return [];
  const projectionScope = and(eq(shopSubscriptions.shop, shop), eq(shopSubscriptions.subscriptionId, observation.subscriptionId), eq(shopSubscriptions.appliedOccurredAt, observation.occurredAt), eq(shopSubscriptions.appliedExternalId, observation.externalId));
  const matchingProjection = exists(db.select({ shop: shopSubscriptions.shop }).from(shopSubscriptions).where(projectionScope));
  return [
    db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, shop), eq(shopSubscriptionItems.subscriptionId, observation.subscriptionId), matchingProjection)),
    ...observation.items.map((item, position) => db.insert(shopSubscriptionItems).select(db.select({
      shop: shopSubscriptions.shop, subscriptionId: shopSubscriptions.subscriptionId,
      position: sql<number>`${position}`.as("position"), itemType: sql<string>`${item.itemType}`.as("item_type"),
      priceAmount: sql<number | null>`${item.priceAmount ?? null}`.as("price_amount"), priceCurrency: sql<string | null>`${item.priceCurrency ?? null}`.as("price_currency"),
      cappedAmountAmount: sql<number | null>`${item.cappedAmountAmount ?? null}`.as("capped_amount_amount"), cappedAmountCurrency: sql<string | null>`${item.cappedAmountCurrency ?? null}`.as("capped_amount_currency"),
    }).from(shopSubscriptions).where(projectionScope))),
  ];
}

/** Advisory cache: a failed invalidation is logged, never allowed to fail the write that already landed. */
async function invalidateCache(cache: SubscriptionCacheInvalidator, shop: string): Promise<void> {
  try {
    await cache.invalidate(shop);
  } catch (error) {
    console.error(JSON.stringify({
      event: "entitlements.cache_invalidation_failed",
      shop,
      error: error instanceof Error ? error.message : "unknown",
    }));
  }
}

/** D1 caps bound parameters at 100 per statement. */
const SHOP_CHUNK = 90;

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

  /**
   * Current projections for just these shops. D1 allows 100 bound parameters per
   * statement, so the shop list is read in chunks of 90 — a handful of queries
   * at most, never one per shop.
   */
  async listCurrentForShops(shopDomains: readonly string[]): Promise<CurrentSubscriptionProjection[]> {
    const unique = [...new Set(shopDomains)];
    const rows: CurrentSubscriptionProjection[] = [];
    for (let from = 0; from < unique.length; from += SHOP_CHUNK) {
      const chunk = unique.slice(from, from + SHOP_CHUNK);
      rows.push(...await getDb().select({
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
      )).where(inArray(shopSubscriptions.shop, chunk)).orderBy(shopSubscriptionItems.position));
    }
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
    const status = statusByKind[state.kind];
    const changed = projectionChanged(observation, current, status);
    const nextRevision = changed ? (current?.revision ?? 0) + 1 : (current?.revision ?? 1);
    const columns = projectionColumns(observation, current, status);
    const parentProjection = db.insert(shopSubscriptions).values({
      shop, subscriptionId: observation.subscriptionId, ...columns, revision: nextRevision,
    }).onConflictDoUpdate({ target: [shopSubscriptions.shop, shopSubscriptions.subscriptionId], set: {
      ...columns,
      revision: changed ? sql`${shopSubscriptions.revision} + 1` : shopSubscriptions.revision,
    }, where: or(sql`${shopSubscriptions.appliedOccurredAt} < ${observation.occurredAt}`, and(eq(shopSubscriptions.appliedOccurredAt, observation.occurredAt), sql`${shopSubscriptions.appliedExternalId} < ${observation.externalId}`)) }).returning({ subscriptionId: shopSubscriptions.subscriptionId });
    const [applied] = await db.batch([parentProjection, ...itemReplacement(db, shop, observation)]);
    if (applied.length === 0 && !duplicate) return "stale";
    await db.batch([
      db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, shop), ne(shopSubscriptionItems.subscriptionId, observation.subscriptionId))),
      db.delete(shopSubscriptions).where(and(eq(shopSubscriptions.shop, shop), ne(shopSubscriptions.subscriptionId, observation.subscriptionId))),
    ]);
    if (this.cache && (duplicate || applied.length > 0)) await invalidateCache(this.cache, shop);
    return duplicate ? "duplicate" : "applied";
  }

  async upsertSubscriptionProjection(shop: string, observation: SubscriptionObservationInput): Promise<"applied" | "stale" | "duplicate"> {
    return this.upsertObservation(shop, observation);
  }
}
