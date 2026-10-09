import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { makeDb } from "~/db/client";
import { shops, shopSubscriptionItems, shopSubscriptions } from "~/db/schema";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { trendWindows, assembleTrend } from "~/domain/merchant-trend";
import { computeBillingStatsFromGroups } from "~/billing/dashboard-stats";
import { ShopMetricsRepo } from "./shop-metrics.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const at = (iso: string) => Date.parse(iso);

interface Seed {
  readonly shop: string;
  readonly installed: string;
  readonly uninstalled?: string;
  readonly dev?: boolean;
  readonly status?: "INSTALLED" | "UNINSTALLED" | "DEACTIVATED" | "REACTIVATED";
  readonly plan?: { handle: string; status: "ACTIVE" | "CANCELED" | "FROZEN"; interval?: string; prices?: number[] };
}

async function seed(rows: readonly Seed[]) {
  const db = makeDb(env.DB);
  for (const row of rows) {
    await db.insert(shops).values({
      shop: row.shop,
      installedAt: at(row.installed),
      uninstalledAt: row.uninstalled ? at(row.uninstalled) : null,
      isDevStore: row.dev ?? false,
      relationshipStatus: row.status ?? (row.uninstalled ? "UNINSTALLED" : "INSTALLED"),
    });
    if (!row.plan) continue;
    await db.insert(shopSubscriptions).values({
      shop: row.shop,
      subscriptionId: `sub-${row.shop}`,
      status: row.plan.status,
      planHandle: row.plan.handle,
      billingInterval: row.plan.interval ?? "EVERY_30_DAYS",
      appliedOccurredAt: 1,
      appliedExternalId: "e",
    });
    for (const [position, price] of (row.plan.prices ?? []).entries()) {
      await db.insert(shopSubscriptionItems).values({
        shop: row.shop,
        subscriptionId: `sub-${row.shop}`,
        position,
        itemType: "base",
        priceAmount: price,
        priceCurrency: "USD",
      });
    }
  }
}

const NOW = at("2026-08-15T12:00:00.000Z");

describe("ShopMetricsRepo.installTrend", () => {
  const trend = (months: number) =>
    inRequest(async () => {
      const windows = trendWindows(months, NOW);
      return assembleTrend(windows, await new ShopMetricsRepo().installTrend(windows));
    });

  it("reports zero everywhere when no shop has ever installed", async () => {
    expect(await trend(3)).toEqual([
      { month: "Jun", installs: 0, uninstalls: 0, active: 0 },
      { month: "Jul", installs: 0, uninstalls: 0, active: 0 },
      { month: "Aug", installs: 0, uninstalls: 0, active: 0 },
    ]);
  });

  it("adds up installs, uninstalls and the active snapshot across many shops", async () => {
    await seed([
      { shop: "a.myshopify.com", installed: "2026-06-02T00:00:00.000Z" },
      { shop: "b.myshopify.com", installed: "2026-06-20T00:00:00.000Z" },
      { shop: "c.myshopify.com", installed: "2026-07-05T00:00:00.000Z", uninstalled: "2026-08-01T00:00:00.000Z" },
      { shop: "d.myshopify.com", installed: "2026-08-09T00:00:00.000Z" },
    ]);
    expect(await trend(3)).toEqual([
      { month: "Jun", installs: 2, uninstalls: 0, active: 2 },
      { month: "Jul", installs: 1, uninstalls: 0, active: 3 },
      { month: "Aug", installs: 1, uninstalls: 1, active: 3 },
    ]);
  });

  it("counts a shop installed before the window as active throughout, and ignores one gone before it", async () => {
    await seed([
      { shop: "old.myshopify.com", installed: "2020-01-01T00:00:00.000Z" },
      { shop: "gone.myshopify.com", installed: "2020-01-01T00:00:00.000Z", uninstalled: "2020-06-01T00:00:00.000Z" },
    ]);
    const result = await trend(3);
    expect(result.map((m) => m.active)).toEqual([1, 1, 1]);
    expect(result.map((m) => m.installs)).toEqual([0, 0, 0]);
    expect(result.map((m) => m.uninstalls)).toEqual([0, 0, 0]);
  });

  it("treats a shop that left in the last millisecond of a month as gone that month", async () => {
    await seed([{ shop: "edge.myshopify.com", installed: "2026-06-01T00:00:00.000Z", uninstalled: "2026-07-31T23:59:59.999Z" }]);
    const result = await trend(3);
    expect(result.map((m) => m.uninstalls)).toEqual([0, 1, 0]);
    expect(result.map((m) => m.active)).toEqual([1, 0, 0]);
  });

  it("keeps growth reconcilable across a window wider than one query chunk", async () => {
    await seed([
      { shop: "a.myshopify.com", installed: "2025-09-02T00:00:00.000Z" },
      { shop: "b.myshopify.com", installed: "2026-01-20T00:00:00.000Z", uninstalled: "2026-03-09T00:00:00.000Z" },
      { shop: "c.myshopify.com", installed: "2026-03-05T00:00:00.000Z", uninstalled: "2026-08-01T00:00:00.000Z" },
      { shop: "d.myshopify.com", installed: "2026-08-09T00:00:00.000Z" },
      { shop: "e.myshopify.com", installed: "2020-01-01T00:00:00.000Z" },
    ]);
    const result = await trend(12);
    expect(result).toHaveLength(12);
    result.slice(1).forEach((current, index) => {
      const previous = result[index];
      expect(current.active, `month ${current.month}`).toBe(
        (previous?.active ?? 0) + current.installs - current.uninstalls,
      );
    });
    expect(result.at(-1)?.active).toBe(3);
  });
});

describe("ShopMetricsRepo billing aggregates", () => {
  it("produce the same dashboard numbers the per-shop rows would", async () => {
    await seed([
      { shop: "pro.myshopify.com", installed: "2026-01-01T00:00:00.000Z", plan: { handle: "pro", status: "ACTIVE", prices: [1900, 500] } },
      { shop: "annual.myshopify.com", installed: "2026-01-01T00:00:00.000Z", plan: { handle: "pro", status: "ACTIVE", interval: "ANNUAL", prices: [19000] } },
      { shop: "free.myshopify.com", installed: "2026-01-01T00:00:00.000Z" },
      { shop: "canceled.myshopify.com", installed: "2026-01-01T00:00:00.000Z", plan: { handle: "pro", status: "CANCELED", prices: [1900] } },
      { shop: "dev.myshopify.com", installed: "2026-01-01T00:00:00.000Z", dev: true, plan: { handle: "pro", status: "ACTIVE", prices: [7900] } },
      { shop: "left.myshopify.com", installed: "2026-01-01T00:00:00.000Z", uninstalled: "2026-02-01T00:00:00.000Z", plan: { handle: "pro", status: "ACTIVE", prices: [9900] } },
    ]);
    const stats = await inRequest(async () => {
      const metrics = new ShopMetricsRepo();
      return computeBillingStatsFromGroups(await metrics.billingShopGroups(), await metrics.billingRevenueGroups());
    });
    expect(stats).toMatchObject({ totalShops: 4, paidShops: 2, freeShops: 2, devShops: 1 });
    expect(stats.shopsByPlan).toEqual({ free: 2, pro: 2 });
    // 1900 + 500 (two items, one shop) + round(19000 / 12) = 1583.
    expect(stats.mrrByCurrency).toEqual([{ amount: 3983, currency: "USD" }]);
  });

  it("includes dev-store revenue only when asked", async () => {
    await seed([
      { shop: "real.myshopify.com", installed: "2026-01-01T00:00:00.000Z", plan: { handle: "pro", status: "ACTIVE", prices: [2900] } },
      { shop: "dev.myshopify.com", installed: "2026-01-01T00:00:00.000Z", dev: true, plan: { handle: "pro", status: "ACTIVE", prices: [7900] } },
    ]);
    const [realOnly, withDev] = await inRequest(async () => {
      const metrics = new ShopMetricsRepo();
      return [await metrics.billingRevenueGroups(), await metrics.billingRevenueGroups(true)];
    });
    expect(realOnly.reduce((total, g) => total + g.items, 0)).toBe(1);
    expect(withDev.reduce((total, g) => total + g.items, 0)).toBe(2);
  });

  it("groups active shops per plan and splits real from dev", async () => {
    await seed([
      { shop: "a.myshopify.com", installed: "2026-01-01T00:00:00.000Z", plan: { handle: "pro", status: "ACTIVE" } },
      { shop: "b.myshopify.com", installed: "2026-01-01T00:00:00.000Z" },
      { shop: "c.myshopify.com", installed: "2026-01-01T00:00:00.000Z", dev: true },
      { shop: "d.myshopify.com", installed: "2026-01-01T00:00:00.000Z", uninstalled: "2026-02-01T00:00:00.000Z" },
    ]);
    const { breakdown, active } = await inRequest(async () => {
      const metrics = new ShopMetricsRepo();
      return { breakdown: await metrics.planBreakdown(), active: await metrics.activeCounts() };
    });
    expect(breakdown).toHaveLength(3);
    expect(breakdown).toEqual(expect.arrayContaining([
      { planHandle: "pro", isDevStore: false, shops: 1 },
      { planHandle: null, isDevStore: false, shops: 1 },
      { planHandle: null, isDevStore: true, shops: 1 },
    ]));
    expect(active).toEqual({ real: 2, dev: 1 });
  });
});

describe("ShopMetricsRepo.churnCounts", () => {
  it("counts installs, uninstalls and real/dev splits inside the period", async () => {
    await seed([
      { shop: "old.myshopify.com", installed: "2025-01-01T00:00:00.000Z" },
      { shop: "new.myshopify.com", installed: "2026-08-10T00:00:00.000Z" },
      { shop: "newdev.myshopify.com", installed: "2026-08-10T00:00:00.000Z", dev: true },
      { shop: "left.myshopify.com", installed: "2025-01-01T00:00:00.000Z", uninstalled: "2026-08-12T00:00:00.000Z" },
      { shop: "longgone.myshopify.com", installed: "2025-01-01T00:00:00.000Z", uninstalled: "2025-06-01T00:00:00.000Z" },
    ]);
    const counts = await inRequest(() => new ShopMetricsRepo().churnCounts(at("2026-07-16T00:00:00.000Z")));
    expect(counts).toEqual({
      total: 5,
      active: 3,
      realActive: 2,
      devActive: 1,
      realUninstalled: 2,
      installedInPeriod: 2,
      realInstalledInPeriod: 1,
      uninstalledInPeriod: 1,
      realUninstalledInPeriod: 1,
    });
  });

  it("is all zeros with no shops", async () => {
    const counts = await inRequest(() => new ShopMetricsRepo().churnCounts(0));
    expect(Object.values(counts).every((value) => value === 0)).toBe(true);
  });
});

describe("ShopMetricsRepo.directory", () => {
  const rows = [
    { shop: "a.myshopify.com", installed: "2026-01-01T00:00:00.000Z", plan: { handle: "pro", status: "ACTIVE" as const } },
    { shop: "b.myshopify.com", installed: "2026-02-01T00:00:00.000Z" },
    { shop: "c.myshopify.com", installed: "2026-03-01T00:00:00.000Z", dev: true },
    { shop: "d.myshopify.com", installed: "2026-04-01T00:00:00.000Z", uninstalled: "2026-05-01T00:00:00.000Z", plan: { handle: "Legacy", status: "CANCELED" as const } },
  ];
  const directory = (query: Partial<Parameters<ShopMetricsRepo["directory"]>[0]>) =>
    inRequest(async () => (await new ShopMetricsRepo().directory({ activity: "all", kind: "all", limit: 50, ...query })).map((row) => row.shop));

  it("lists newest install first and applies the limit in SQL", async () => {
    await seed(rows);
    expect(await directory({})).toEqual(["d.myshopify.com", "c.myshopify.com", "b.myshopify.com", "a.myshopify.com"]);
    expect(await directory({ limit: 2 })).toEqual(["d.myshopify.com", "c.myshopify.com"]);
  });

  it("filters by activity and kind", async () => {
    await seed(rows);
    expect(await directory({ activity: "uninstalled" })).toEqual(["d.myshopify.com"]);
    expect(await directory({ activity: "active", kind: "real" })).toEqual(["b.myshopify.com", "a.myshopify.com"]);
    expect(await directory({ kind: "dev" })).toEqual(["c.myshopify.com"]);
  });

  it("filters by plan handle case-insensitively, with `free` covering shops without a subscription", async () => {
    await seed(rows);
    expect(await directory({ planHandles: ["pro"] })).toEqual(["a.myshopify.com"]);
    expect(await directory({ planHandles: ["legacy"] })).toEqual(["d.myshopify.com"]);
    expect(await directory({ planHandles: ["free"] })).toEqual(["c.myshopify.com", "b.myshopify.com"]);
  });

  it("returns subscription columns beside the shop", async () => {
    await seed(rows);
    const [first] = await inRequest(() => new ShopMetricsRepo().directory({ activity: "all", kind: "all", planHandles: ["pro"], limit: 5 }));
    expect(first).toMatchObject({ shop: "a.myshopify.com", planHandle: "pro", subscriptionStatus: "ACTIVE" });
  });

  it("lists installs since a cutoff and the picker contacts", async () => {
    await seed(rows);
    const recent = await inRequest(() => new ShopMetricsRepo().installedSince(at("2026-02-15T00:00:00.000Z"), "real"));
    expect(recent.map((row) => row.shop)).toEqual(["d.myshopify.com"]);
    const contacts = await inRequest(() => new ShopMetricsRepo().contacts());
    expect(contacts.map((row) => row.shop)).toEqual(["a.myshopify.com", "b.myshopify.com", "c.myshopify.com", "d.myshopify.com"]);
  });
});
