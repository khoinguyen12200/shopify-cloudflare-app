import { and, eq, ne, or, sql } from "drizzle-orm";
import type { SubscriptionStatus, SubscriptionObservation } from "~/domain/subscription-lifecycle";
import { shopSubscriptionItems, shopSubscriptions } from "~/db/schema";
import { getDb } from "~/request-context.server";

export type SubscriptionObservationInput = SubscriptionObservation & {
  readonly subscriptionId: string;
  readonly planHandle?: string | null;
  readonly billingInterval?: string | null;
  readonly trialEndsAt?: number | null;
  readonly currentPeriodStartsAt?: number | null;
  readonly currentPeriodEndsAt?: number | null;
  readonly cancellationEffectiveAt?: number | null;
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
}

const statusByKind: Record<string, SubscriptionStatus> = {
  none: "NONE", pending: "PENDING", active: "ACTIVE", cancellation_scheduled: "CANCELLATION_SCHEDULED",
  frozen: "FROZEN", canceled: "CANCELED", unknown: "UNKNOWN",
};
const kindByStatus: Record<SubscriptionStatus, "none" | "pending" | "active" | "cancellation_scheduled" | "frozen" | "canceled" | "unknown"> = {
  NONE: "none", PENDING: "pending", ACTIVE: "active", CANCELLATION_SCHEDULED: "cancellation_scheduled", FROZEN: "frozen", CANCELED: "canceled", UNKNOWN: "unknown",
};

export class ShopSubscriptionRepo {
  async currentForShop(shop: string): Promise<CurrentSubscriptionProjection | undefined> {
    const rows = await getDb().select({
      shop: shopSubscriptions.shop,
      status: shopSubscriptions.status,
      billingInterval: shopSubscriptions.billingInterval,
      planHandle: shopSubscriptions.planHandle,
      priceAmount: shopSubscriptionItems.priceAmount,
      priceCurrency: shopSubscriptionItems.priceCurrency,
    }).from(shopSubscriptions).leftJoin(shopSubscriptionItems, and(
      eq(shopSubscriptionItems.shop, shopSubscriptions.shop),
      eq(shopSubscriptionItems.subscriptionId, shopSubscriptions.subscriptionId),
    )).where(eq(shopSubscriptions.shop, shop)).orderBy(shopSubscriptionItems.position);
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
    const applied = await db.insert(shopSubscriptions).values({
      shop, subscriptionId: observation.subscriptionId, status: statusByKind[state.kind],
      planHandle: observation.planHandle === undefined ? current?.planHandle ?? null : observation.planHandle,
      billingInterval: observation.billingInterval === undefined ? current?.billingInterval ?? null : observation.billingInterval,
      trialEndsAt: observation.trialEndsAt === undefined ? current?.trialEndsAt ?? null : observation.trialEndsAt,
      currentPeriodStartsAt: observation.currentPeriodStartsAt === undefined ? current?.currentPeriodStartsAt ?? null : observation.currentPeriodStartsAt,
      currentPeriodEndsAt: observation.currentPeriodEndsAt === undefined ? current?.currentPeriodEndsAt ?? null : observation.currentPeriodEndsAt,
      cancellationEffectiveAt: observation.cancellationEffectiveAt === undefined ? current?.cancellationEffectiveAt ?? null : observation.cancellationEffectiveAt,
      pendingPlanHandle: observation.pendingPlanHandle === undefined ? current?.pendingPlanHandle ?? null : observation.pendingPlanHandle,
      pendingBillingInterval: observation.pendingBillingInterval === undefined ? current?.pendingBillingInterval ?? null : observation.pendingBillingInterval,
      pendingLegacySubscriptionId: observation.pendingLegacySubscriptionId === undefined ? current?.pendingLegacySubscriptionId ?? null : observation.pendingLegacySubscriptionId,
      appliedOccurredAt: observation.occurredAt, appliedExternalId: observation.externalId,
    }).onConflictDoUpdate({ target: [shopSubscriptions.shop, shopSubscriptions.subscriptionId], set: {
      status: statusByKind[state.kind],
      planHandle: observation.planHandle === undefined ? current?.planHandle ?? null : observation.planHandle,
      billingInterval: observation.billingInterval === undefined ? current?.billingInterval ?? null : observation.billingInterval,
      trialEndsAt: observation.trialEndsAt === undefined ? current?.trialEndsAt ?? null : observation.trialEndsAt,
      currentPeriodStartsAt: observation.currentPeriodStartsAt === undefined ? current?.currentPeriodStartsAt ?? null : observation.currentPeriodStartsAt,
      currentPeriodEndsAt: observation.currentPeriodEndsAt === undefined ? current?.currentPeriodEndsAt ?? null : observation.currentPeriodEndsAt,
      cancellationEffectiveAt: observation.cancellationEffectiveAt === undefined ? current?.cancellationEffectiveAt ?? null : observation.cancellationEffectiveAt,
      pendingPlanHandle: observation.pendingPlanHandle === undefined ? current?.pendingPlanHandle ?? null : observation.pendingPlanHandle,
      pendingBillingInterval: observation.pendingBillingInterval === undefined ? current?.pendingBillingInterval ?? null : observation.pendingBillingInterval,
      pendingLegacySubscriptionId: observation.pendingLegacySubscriptionId === undefined ? current?.pendingLegacySubscriptionId ?? null : observation.pendingLegacySubscriptionId,
      appliedOccurredAt: observation.occurredAt, appliedExternalId: observation.externalId,
    }, where: or(sql`${shopSubscriptions.appliedOccurredAt} < ${observation.occurredAt}`, and(eq(shopSubscriptions.appliedOccurredAt, observation.occurredAt), sql`${shopSubscriptions.appliedExternalId} < ${observation.externalId}`)) }).returning({ subscriptionId: shopSubscriptions.subscriptionId });
    if (applied.length === 0 && !duplicate) return "stale";
    if (observation.items) {
      const replacement = db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, shop), eq(shopSubscriptionItems.subscriptionId, observation.subscriptionId)));
      const rows = observation.items.map((item, position) => ({ shop, subscriptionId: observation.subscriptionId, position, itemType: item.itemType, priceAmount: item.priceAmount ?? null, priceCurrency: item.priceCurrency ?? null, cappedAmountAmount: item.cappedAmountAmount ?? null, cappedAmountCurrency: item.cappedAmountCurrency ?? null }));
      await db.batch(rows.length ? [replacement, db.insert(shopSubscriptionItems).values(rows)] : [replacement]);
    }
    if (observation.type === "ACTIVE_SUBSCRIPTION" && observation.status === "NONE") {
      await db.batch([
        db.delete(shopSubscriptionItems).where(and(eq(shopSubscriptionItems.shop, shop), ne(shopSubscriptionItems.subscriptionId, observation.subscriptionId))),
        db.delete(shopSubscriptions).where(and(eq(shopSubscriptions.shop, shop), ne(shopSubscriptions.subscriptionId, observation.subscriptionId))),
      ]);
    }
    return duplicate ? "duplicate" : "applied";
  }

  async upsertSubscriptionProjection(shop: string, observation: SubscriptionObservationInput): Promise<"applied" | "stale" | "duplicate"> {
    return this.upsertObservation(shop, observation);
  }
}
