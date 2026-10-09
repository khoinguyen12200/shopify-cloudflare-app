import { shops, shopifyEvents, shopSyncCheckpoints, webhookDeliveryRepository, refreshShopHistory, refreshShopSubscription } from "~/wiring.server";
import { getEnv } from "~/request-context.server";
import { PLAN_LIST } from "~/billing/plans";
import { getShopPromoStatus } from "~/services/internal-admin/ops.server";
import { resolveEffectivePlan } from "~/domain/plan-hierarchy";
import { buildEventHistory } from "./detail-events";

/** Re-pull Partner history and subscription when the shop was never reconciled or is stale. */
async function refreshIfStale(shop: {
  readonly shop: string;
  readonly shopifyShopId: string | null;
  readonly lastReconciledAt: number | null;
}): Promise<void> {
  const stale =
    shop.shopifyShopId === null ||
    shop.lastReconciledAt === null ||
    Date.now() - shop.lastReconciledAt > 5 * 60 * 1000;
  if (!stale) return;
  await Promise.all([
    refreshShopHistory(getEnv(), shop.shop),
    refreshShopSubscription(getEnv(), shop.shop),
  ]);
}

/**
 * Everything the shop detail page shows, or `null` when there is no such shop.
 * Started by the loader WITHOUT awaiting, so the page frame never waits on it.
 */
export async function loadShopDetail(shopDomain: string) {
  const shop = await shops().get(shopDomain);
  if (!shop) return null;

  await refreshIfStale(shop);

  const eventsRepo = shopifyEvents();
  const [history, relationshipEvents, deliveries, reconciliation, promoStatus] = await Promise.all([
    eventsRepo.listSubscriptionEvents(shopDomain),
    eventsRepo.listRelationshipEvents(shopDomain),
    webhookDeliveryRepository().listForShop(shopDomain),
    shopSyncCheckpoints().read(`partner_history:${shopDomain}`),
    getShopPromoStatus(shopDomain),
  ]);

  const latestSub = history[0];
  const now = Date.now();
  const effective = resolveEffectivePlan(
    latestSub?.planHandle,
    latestSub?.status,
    promoStatus.activeGrant,
    PLAN_LIST,
    now,
  );

  return {
    shop,
    history,
    events: buildEventHistory(relationshipEvents, history, deliveries),
    reconciliation,
    promoStatus,
    effective,
    promoAvailablePlans: PLAN_LIST.filter((p) => p.priceMonthly.amount > 0).map((p) => ({ handle: p.handle, name: p.name })),
    now,
  };
}
