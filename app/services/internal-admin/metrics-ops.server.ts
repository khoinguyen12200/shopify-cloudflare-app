import {
  aiRepository,
  operationalHealth,
  shops,
  shopSubscriptions,
  supportService,
  webhookDeliveryRepository,
} from "~/wiring.server";
import { computeBillingStats } from "~/billing/dashboard-stats";
import { planForShopifyHandle } from "~/billing/plans";
import { formatMoney } from "~/money";

export interface RevenueAndPlansResult {
  mrr: {
    amount: number;
    currency: string;
    formatted: string;
  }[];
  plans: {
    planHandle: string;
    planName: string;
    realStores: number;
    devStores: number;
  }[];
  summary: {
    totalRealStores: number;
    paidRealStores: number;
    freeRealStores: number;
    devStoresTotal: number;
  };
}

/** Get real MRR, plan distribution, and dev store metrics. */
export async function getRevenueAndPlans({
  excludeDev = true,
}: {
  excludeDev?: boolean;
} = {}): Promise<RevenueAndPlansResult> {
  const [allShops, currentSubscriptions] = await Promise.all([
    shops().listAll(),
    shopSubscriptions().listCurrent(),
  ]);

  const currentByShop = new Map(currentSubscriptions.map((sub) => [sub.shop, sub]));

  // Projections for computeBillingStats
  const projections = allShops
    .filter((s) => s.uninstalledAt === null)
    .map((shop) => {
      const sub = currentByShop.get(shop.shop);
      return {
        shop: shop.shop,
        relationshipStatus: shop.relationshipStatus,
        subscriptionStatus: sub?.status ?? null,
        billingInterval: sub?.billingInterval ?? null,
        priceAmount: sub?.priceAmount ?? null,
        priceCurrency: sub?.priceCurrency ?? null,
        isDevStore: excludeDev ? shop.isDevStore : false,
      };
    });

  const billingStats = computeBillingStats(projections);

  // Group by plan
  const planCounts = new Map<string, { planName: string; real: number; dev: number }>();
  for (const shop of allShops.filter((s) => s.uninstalledAt === null)) {
    const sub = currentByShop.get(shop.shop);
    const planHandle = sub?.planHandle ?? "free";
    const planName = planForShopifyHandle(sub?.planHandle)?.name ?? (sub?.planHandle ? sub.planHandle : "Free");

    const entry = planCounts.get(planHandle) ?? { planName, real: 0, dev: 0 };
    if (shop.isDevStore) {
      entry.dev += 1;
    } else {
      entry.real += 1;
    }
    planCounts.set(planHandle, entry);
  }

  const plans = Array.from(planCounts.entries()).map(([planHandle, data]) => ({
    planHandle,
    planName: data.planName,
    realStores: data.real,
    devStores: data.dev,
  }));

  const mrr = billingStats.mrrByCurrency.map((m) => ({
    amount: m.amount,
    currency: m.currency,
    formatted: formatMoney("en", m),
  }));

  return {
    mrr,
    plans,
    summary: {
      totalRealStores: billingStats.totalShops,
      paidRealStores: billingStats.paidShops,
      freeRealStores: billingStats.freeShops,
      devStoresTotal: allShops.filter((s) => s.isDevStore && s.uninstalledAt === null).length,
    },
  };
}

/** Churn, installs, and active retention numbers. */
export async function getChurnAndRetention({
  periodDays = 30,
  days,
  now = Date.now(),
}: {
  periodDays?: number;
  days?: number;
  now?: number;
} = {}) {
  const windowDays = days ?? periodDays;
  const allShops = await shops().listAll();
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;

  const totalStores = allShops.length;
  const activeStores = allShops.filter((s) => s.uninstalledAt === null);
  const uninstalledStores = allShops.filter((s) => s.uninstalledAt !== null);

  const installedInPeriod = allShops.filter((s) => s.installedAt >= cutoff);
  const uninstalledInPeriod = uninstalledStores.filter(
    (s) => s.uninstalledAt !== null && s.uninstalledAt >= cutoff,
  );

  const realActive = activeStores.filter((s) => !s.isDevStore);
  const realUninstalled = uninstalledStores.filter((s) => !s.isDevStore);
  const realInstalledInPeriod = installedInPeriod.filter((s) => !s.isDevStore);
  const realUninstalledInPeriod = uninstalledInPeriod.filter((s) => !s.isDevStore);

  const churnRate =
    realActive.length + realUninstalledInPeriod.length > 0
      ? (realUninstalledInPeriod.length / (realActive.length + realUninstalledInPeriod.length)) * 100
      : 0;

  return {
    periodDays: days,
    overview: {
      totalAllTime: totalStores,
      currentlyActive: activeStores.length,
      currentlyUninstalled: uninstalledStores.length,
      realActiveStores: realActive.length,
      realUninstalledStores: realUninstalled.length,
      devStoresActive: activeStores.filter((s) => s.isDevStore).length,
    },
    activityInPeriod: {
      installsTotal: installedInPeriod.length,
      installsReal: realInstalledInPeriod.length,
      uninstallsTotal: uninstalledInPeriod.length,
      uninstallsReal: realUninstalledInPeriod.length,
      netStoreGrowth: realInstalledInPeriod.length - realUninstalledInPeriod.length,
      churnRatePercent: Math.round(churnRate * 10) / 10,
    },
  };
}

/** System health vitals. */
export async function getSystemHealth() {
  const [health, allShops, openTickets] = await Promise.all([
    operationalHealth().read(),
    shops().listAll(),
    supportService().listOpenForStaff(),
  ]);

  const activeStores = allShops.filter((s) => s.uninstalledAt === null);

  return {
    failedWebhooks: health.failedWebhooks,
    deadLetterWebhooks: health.deadLetterWebhooks,
    lifecycleEvents: health.lifecycleEvents,
    subscriptionEvents: health.subscriptionEvents,
    totalActiveStores: activeStores.length,
    realActiveStores: activeStores.filter((s) => !s.isDevStore).length,
    devStores: activeStores.filter((s) => s.isDevStore).length,
    openTicketsCount: openTickets.length,
  };
}

/** List failed or dead-letter webhooks. */
export async function listWebhookFailures({
  shop,
  status,
  limit = 20,
}: {
  shop?: string;
  status?: "failed" | "dead_letter";
  limit?: number;
} = {}) {
  const deliveries = await webhookDeliveryRepository().listFailures({ shop, status, limit });
  return deliveries.map((d) => ({
    id: d.id,
    topic: d.topic,
    shop: d.shop,
    status: d.status,
    attempts: d.attempts,
    failureCode: d.failureCode,
    failureDetail: d.failureDetail,
    receivedAt: d.receivedAt,
    failedAt: d.failedAt,
  }));
}

/** Workers AI spend and tokens telemetry. */
export async function getAiSpendAndUsage({
  sinceDays = 30,
  now = Date.now(),
}: {
  sinceDays?: number;
  now?: number;
} = {}) {
  const cutoff = now - sinceDays * 24 * 60 * 60 * 1000;
  const repo = aiRepository();

  const [spend, recentRuns] = await Promise.all([
    repo.tokensSince(cutoff),
    repo.recentRuns(15),
  ]);

  return {
    periodDays: sinceDays,
    calls: spend.calls,
    inputTokens: spend.input,
    outputTokens: spend.output,
    totalTokens: spend.input + spend.output,
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      feature: r.feature,
      role: r.role,
      modelId: r.modelId,
      status: r.status,
      latencyMs: r.latencyMs,
      tokens: (r.inputTokens ?? 0) + (r.outputTokens ?? 0),
    })),
  };
}
