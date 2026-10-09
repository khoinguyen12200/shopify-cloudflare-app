import {
  aiRepository,
  operationalHealth,
  shopMetrics,
  supportService,
  webhookDeliveryRepository,
} from "~/wiring.server";
import { computeBillingStatsFromGroups } from "~/billing/dashboard-stats";
import { planForShopifyHandle } from "~/billing/plans";
import { assembleTrend, trendWindows } from "~/domain/merchant-trend";
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

/** The dashboard's billing stats and merchant trend, both computed by grouped SQL. */
export async function loadDashboardOverview({ trendMonths, now }: { trendMonths: number; now: number }) {
  const metrics = shopMetrics();
  const windows = trendWindows(trendMonths, now);
  const [shopGroups, revenueGroups, counts] = await Promise.all([
    metrics.billingShopGroups(),
    metrics.billingRevenueGroups(),
    metrics.installTrend(windows),
  ]);
  return {
    stats: computeBillingStatsFromGroups(shopGroups, revenueGroups),
    trend: assembleTrend(windows, counts),
  };
}

/** Display name for a stored plan handle; no subscription means the free plan. */
function planNameFor(planHandle: string | null): string {
  return planForShopifyHandle(planHandle)?.name ?? (planHandle ? planHandle : "Free");
}

/** Get real MRR, plan distribution, and dev store metrics. */
export async function getRevenueAndPlans({
  excludeDev = true,
}: {
  excludeDev?: boolean;
} = {}): Promise<RevenueAndPlansResult> {
  const metrics = shopMetrics();
  const [shopGroups, revenueGroups, breakdown] = await Promise.all([
    metrics.billingShopGroups(),
    metrics.billingRevenueGroups(!excludeDev),
    metrics.planBreakdown(),
  ]);

  const billingStats = computeBillingStatsFromGroups(
    excludeDev ? shopGroups : shopGroups.map((group) => ({ ...group, isDevStore: false })),
    revenueGroups,
  );

  const planCounts = new Map<string, { planName: string; real: number; dev: number }>();
  let devStoresTotal = 0;
  for (const row of breakdown) {
    const planHandle = row.planHandle ?? "free";
    const entry = planCounts.get(planHandle) ?? { planName: planNameFor(row.planHandle), real: 0, dev: 0 };
    if (row.isDevStore) {
      entry.dev += row.shops;
      devStoresTotal += row.shops;
    } else {
      entry.real += row.shops;
    }
    planCounts.set(planHandle, entry);
  }

  const plans = Array.from(planCounts.entries())
    .map(([planHandle, data]) => ({
      planHandle,
      planName: data.planName,
      realStores: data.real,
      devStores: data.dev,
    }))
    .sort((a, b) => a.planHandle.localeCompare(b.planHandle));

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
      devStoresTotal,
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
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  const counts = await shopMetrics().churnCounts(cutoff);

  const churnRate =
    counts.realActive + counts.realUninstalledInPeriod > 0
      ? (counts.realUninstalledInPeriod / (counts.realActive + counts.realUninstalledInPeriod)) * 100
      : 0;

  return {
    periodDays: days,
    overview: {
      totalAllTime: counts.total,
      currentlyActive: counts.active,
      currentlyUninstalled: counts.total - counts.active,
      realActiveStores: counts.realActive,
      realUninstalledStores: counts.realUninstalled,
      devStoresActive: counts.devActive,
    },
    activityInPeriod: {
      installsTotal: counts.installedInPeriod,
      installsReal: counts.realInstalledInPeriod,
      uninstallsTotal: counts.uninstalledInPeriod,
      uninstallsReal: counts.realUninstalledInPeriod,
      netStoreGrowth: counts.realInstalledInPeriod - counts.realUninstalledInPeriod,
      churnRatePercent: Math.round(churnRate * 10) / 10,
    },
  };
}

/** System health vitals. */
export async function getSystemHealth() {
  const [health, active, openTickets] = await Promise.all([
    operationalHealth().read(),
    shopMetrics().activeCounts(),
    supportService().listOpenForStaff(),
  ]);

  return {
    failedWebhooks: health.failedWebhooks,
    deadLetterWebhooks: health.deadLetterWebhooks,
    lifecycleEvents: health.lifecycleEvents,
    subscriptionEvents: health.subscriptionEvents,
    totalActiveStores: active.real + active.dev,
    realActiveStores: active.real,
    devStores: active.dev,
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
