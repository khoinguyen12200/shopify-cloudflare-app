import { ShopifyPartnerAdapter } from "~/adapters/shopify-partner.server";
import { ENTITLEMENT_CATALOGUE } from "~/billing/entitlement-catalogue";
import { PLAN_LIST } from "~/billing/plans";
import { resolveEffectivePlan } from "~/domain/plan-hierarchy";
import type { ShopifyEventRepo } from "~/models/shopify-events.server";
import type { ExistingQuotaOperation, SubscriptionPort } from "~/ports/entitlements";
import { EntitlementRepo } from "~/models/entitlements.server";
import { getEnv } from "~/request-context.server";
import { createEntitlements, type EntitlementService } from "~/services/entitlements.server";
import { reconcileShopHistory } from "~/services/reconcile-shopify-history";
import { refreshSubscription } from "~/services/reconcile-subscription";
import { entitlementCachePort, invalidateEntitlements } from "~/wiring/entitlement-cache.server";
import { planGrants, shopifyEvents, shops, shopSubscriptions, shopSyncCheckpoints } from "~/wiring/repositories.server";
import { appRuntime } from "~/wiring/runtime.server";

export function subscriptionsPort(): SubscriptionPort {
  const current = async (shop: string) => {
    const relationship = await shops().get(shop);
    if (!relationship || relationship.relationshipStatus !== "INSTALLED") return { status: "UNKNOWN" as const, planHandle: null, revision: 0 };
    const now = appRuntime().clock.now();
    const [projection, activeGrant] = await Promise.all([
      shopSubscriptions().currentForShop(shop),
      planGrants().findActiveGrant(shop, now),
    ]);
    const effective = resolveEffectivePlan(
      projection?.planHandle,
      projection?.status,
      activeGrant,
      PLAN_LIST,
      now,
    );
    const effectiveStatus = effective.source === "promo"
      ? ("ACTIVE" as const)
      : (projection?.status ?? ("UNKNOWN" as const));

    return {
      status: effectiveStatus,
      planHandle: effective.planHandle,
      revision: projection?.revision ?? 0,
      periodStart: projection?.currentPeriodStartsAt ?? activeGrant?.startsAt ?? undefined,
      periodEnd: projection?.currentPeriodEndsAt ?? activeGrant?.expiresAt ?? undefined,
      cancellationEffectiveAt: projection?.cancellationEffectiveAt ?? undefined,
    };
  };
  return { current, async refresh(shop) {
    const env = getEnv();
    const result = await refreshShopSubscription(env, shop);
    if (result.status === "failed") throw new Error(result.detail);
    return current(shop);
  } };
}

export function entitlements(): EntitlementService {
  const repo = new EntitlementRepo(appRuntime().clock);
  return createEntitlements({
    subscriptions: subscriptionsPort(),
    usage: {
      find: async (shop, operationId) => {
        const row = await repo.findOperation(shop, operationId);
        const state = row?.state;
        const validState = state === "held" || state === "committed" || state === "released";
        const operation: ExistingQuotaOperation | undefined = row && validState
          ? { key: row.key, amount: row.requestedAmount, period: row.period, subscriptionRevision: row.subscriptionRevision, state }
          : undefined;
        return operation;
      },
      reserve: (input) => repo.reserve(input),
      commit: async (input) => {
        const result = await repo.commit(input);
        return "reason" in result
          ? { allowed: false, reason: result.reason }
          : { allowed: true, operationId: input.operationId, state: "committed", ...(result.replayed ? { replayed: true } : {}) };
      },
      release: async (input) => {
        const result = await repo.release(input);
        return "reason" in result
          ? { allowed: false, reason: result.reason }
          : { allowed: true, operationId: input.operationId, state: result.state === "committed" ? "committed" : "released", ...(result.replayed ? { replayed: true } : {}) };
      },
    },
    capacity: { allocate: (input) => repo.allocate(input), confirmAllocation: (input) => repo.confirmAllocation(input), deallocate: (input) => repo.deallocate(input) },
    cache: entitlementCachePort(),
    catalogue: ENTITLEMENT_CATALOGUE,
  });
}

/** Targeted billing refresh composition. Missing Partner credentials stay observable. */
export async function refreshShopSubscription(env: Env, shop: string, now = appRuntime().clock.now()) {
  const identity = await shops().get(shop);
  const partner = new ShopifyPartnerAdapter({
    token: env.SHOPIFY_PARTNER_API_TOKEN || "",
    organizationId: env.SHOPIFY_PARTNER_ORGANIZATION_ID || "",
    apiVersion: env.SHOPIFY_PARTNER_API_VERSION || "",
    fetch,
  });
  return refreshSubscription({
    partner,
    subscriptions: { upsertSubscriptionProjection: (tenant, observation) => shopSubscriptions().upsertObservation(tenant, observation) },
    clock: { now: () => now },
    appId: env.SHOPIFY_PARTNER_APP_ID || null,
  }, { shop, shopifyShopId: identity?.shopifyShopId ?? null, installedAt: identity?.installedAt ?? null }, now);
}

export async function refreshShopHistory(env: Env, shop: string, now = appRuntime().clock.now()) {
  const identity = await shops().get(shop);
  const checkpoints = shopSyncCheckpoints();
  const result = await reconcileShopHistory({
    partner: new ShopifyPartnerAdapter({ token: env.SHOPIFY_PARTNER_API_TOKEN || "", organizationId: env.SHOPIFY_PARTNER_ORGANIZATION_ID || "", apiVersion: env.SHOPIFY_PARTNER_API_VERSION || "", fetch }),
    ledger: historyLedger(),
    clock: { now: () => now },
    appId: env.SHOPIFY_PARTNER_APP_ID || null,
  }, { shop, shopifyShopId: identity?.shopifyShopId ?? null, installedAt: identity?.installedAt ?? null }, now);
  const checkpointName = `partner_history:${shop}`;
  if (result.status === "succeeded") {
    await Promise.all([
      shops().markReconciled(shop, now),
      checkpoints.markSucceeded(checkpointName, null, now, now),
    ]);
  } else {
    await checkpoints.markFailed(checkpointName, result.code, result.detail, now);
  }
  return result;
}

/** History ledger adapter binding kept here so services never import models. */
export function historyLedger() {
  const repo = shopifyEvents();
  return {
    recordPartnerRelationship: (event: Parameters<ShopifyEventRepo["recordPartnerRelationship"]>[0]) => repo.recordPartnerRelationship(event),
    recordPartnerSubscription: async (event: Parameters<ShopifyEventRepo["recordPartnerSubscription"]>[0]) => {
      const result = await repo.recordPartnerSubscription(event);
      await invalidateEntitlements(event.shop);
      return result;
    },
  };
}
