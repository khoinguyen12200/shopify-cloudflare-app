import { and, count, desc, eq, gte, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { shops, shopSubscriptionItems, shopSubscriptions } from "~/db/schema";
import type { RevenueBillingGroup, ShopBillingGroup } from "~/billing/dashboard-stats";

/**
 * Read-only aggregates for the staff console and its API.
 *
 * These deliberately span every shop: the staff console is the one surface that
 * is not tenant-scoped (see @rules/architecture.md on `admin_users`), so no
 * method here takes a `shop`. Each one returns a bounded result — grouped
 * counts, a LIMITed page, or a single row — never a row per shop that a caller
 * then aggregates in JS.
 */

/** Active shop = the app is still installed. */
const isActive = isNull(shops.uninstalledAt);

/** Months per query; keeps bound parameters well under D1's 100 per statement. */
const WINDOWS_PER_QUERY = 10;

export interface TrendWindowRange {
  readonly start: number;
  readonly end: number;
}

export interface TrendCounts {
  readonly installs: number;
  readonly uninstalls: number;
  readonly active: number;
}

export type ShopKind = "all" | "real" | "dev";
export type ShopActivity = "all" | "active" | "uninstalled";

export interface DirectoryQuery {
  readonly activity: ShopActivity;
  readonly kind: ShopKind;
  /** Lower-cased candidate plan handles; `free` also matches shops with no subscription. */
  readonly planHandles?: readonly string[];
  readonly limit: number;
}

export interface DirectoryRow {
  readonly shop: string;
  readonly name: string | null;
  readonly email: string | null;
  readonly contactEmail: string | null;
  readonly logoUrl: string | null;
  readonly url: string | null;
  readonly shopifyShopId: string | null;
  readonly installedAt: number;
  readonly uninstalledAt: number | null;
  readonly relationshipStatus: (typeof shops.$inferSelect)["relationshipStatus"];
  readonly isDevStore: boolean;
  readonly planHandle: string | null;
  readonly billingInterval: string | null;
  readonly subscriptionStatus: (typeof shopSubscriptions.$inferSelect)["status"] | null;
}

export interface PlanBreakdownRow {
  readonly planHandle: string | null;
  readonly isDevStore: boolean;
  readonly shops: number;
}

export interface ChurnCounts {
  readonly total: number;
  readonly active: number;
  readonly realActive: number;
  readonly devActive: number;
  readonly realUninstalled: number;
  readonly installedInPeriod: number;
  readonly realInstalledInPeriod: number;
  readonly uninstalledInPeriod: number;
  readonly realUninstalledInPeriod: number;
}

function kindPredicate(kind: ShopKind): SQL | undefined {
  if (kind === "real") return eq(shops.isDevStore, false);
  if (kind === "dev") return eq(shops.isDevStore, true);
  return undefined;
}

function activityPredicate(activity: ShopActivity): SQL | undefined {
  if (activity === "active") return isActive;
  if (activity === "uninstalled") return isNotNull(shops.uninstalledAt);
  return undefined;
}

const planHandleOrFree = sql<string>`lower(coalesce(${shopSubscriptions.planHandle}, 'free'))`;

const directoryColumns = {
  shop: shops.shop,
  name: shops.name,
  email: shops.email,
  contactEmail: shops.contactEmail,
  logoUrl: shops.logoUrl,
  url: shops.url,
  shopifyShopId: shops.shopifyShopId,
  installedAt: shops.installedAt,
  uninstalledAt: shops.uninstalledAt,
  relationshipStatus: shops.relationshipStatus,
  isDevStore: shops.isDevStore,
  planHandle: shopSubscriptions.planHandle,
  billingInterval: shopSubscriptions.billingInterval,
  subscriptionStatus: shopSubscriptions.status,
};

export class ShopMetricsRepo {
  /** Active shops grouped by the fields the billing stats depend on. */
  async billingShopGroups(): Promise<ShopBillingGroup[]> {
    return getDb()
      .select({
        relationshipStatus: shops.relationshipStatus,
        subscriptionStatus: shopSubscriptions.status,
        planHandle: shopSubscriptions.planHandle,
        isDevStore: shops.isDevStore,
        shops: count(),
      })
      .from(shops)
      .leftJoin(shopSubscriptions, eq(shopSubscriptions.shop, shops.shop))
      .where(isActive)
      .groupBy(shops.relationshipStatus, shopSubscriptions.status, shopSubscriptions.planHandle, shops.isDevStore);
  }

  /** Priced subscription items of active shops (real only unless `includeDev`), grouped by price. */
  async billingRevenueGroups(includeDev = false): Promise<RevenueBillingGroup[]> {
    return getDb()
      .select({
        relationshipStatus: shops.relationshipStatus,
        subscriptionStatus: shopSubscriptions.status,
        billingInterval: shopSubscriptions.billingInterval,
        priceAmount: shopSubscriptionItems.priceAmount,
        priceCurrency: shopSubscriptionItems.priceCurrency,
        items: count(),
      })
      .from(shops)
      .innerJoin(shopSubscriptions, eq(shopSubscriptions.shop, shops.shop))
      .innerJoin(
        shopSubscriptionItems,
        and(
          eq(shopSubscriptionItems.shop, shopSubscriptions.shop),
          eq(shopSubscriptionItems.subscriptionId, shopSubscriptions.subscriptionId),
        ),
      )
      .where(and(isActive, includeDev ? undefined : eq(shops.isDevStore, false), isNotNull(shopSubscriptionItems.priceAmount)))
      .groupBy(
        shops.relationshipStatus,
        shopSubscriptions.status,
        shopSubscriptions.billingInterval,
        shopSubscriptionItems.priceAmount,
        shopSubscriptionItems.priceCurrency,
      );
  }

  /** Active shops per plan handle (null = no subscription), split by dev/real. */
  async planBreakdown(): Promise<PlanBreakdownRow[]> {
    return getDb()
      .select({ planHandle: shopSubscriptions.planHandle, isDevStore: shops.isDevStore, shops: count() })
      .from(shops)
      .leftJoin(shopSubscriptions, eq(shopSubscriptions.shop, shops.shop))
      .where(isActive)
      .groupBy(shopSubscriptions.planHandle, shops.isDevStore);
  }

  /** Active shops split into real and development stores. */
  async activeCounts(): Promise<{ readonly real: number; readonly dev: number }> {
    const rows = await getDb()
      .select({ isDevStore: shops.isDevStore, shops: count() })
      .from(shops)
      .where(isActive)
      .groupBy(shops.isDevStore);
    return {
      real: rows.find((row) => !row.isDevStore)?.shops ?? 0,
      dev: rows.find((row) => row.isDevStore)?.shops ?? 0,
    };
  }

  /** Install, uninstall and active-at-end counts for each window, in one scan per chunk. */
  async installTrend(windows: readonly TrendWindowRange[]): Promise<TrendCounts[]> {
    const results: TrendCounts[] = [];
    for (let from = 0; from < windows.length; from += WINDOWS_PER_QUERY) {
      const chunk = windows.slice(from, from + WINDOWS_PER_QUERY);
      const columns: Record<string, SQL<number>> = {};
      chunk.forEach((window, index) => {
        columns[`installs${index}`] = sql<number>`coalesce(sum(case when ${shops.installedAt} >= ${window.start} and ${shops.installedAt} < ${window.end} then 1 else 0 end), 0)`;
        columns[`uninstalls${index}`] = sql<number>`coalesce(sum(case when ${shops.uninstalledAt} is not null and ${shops.uninstalledAt} >= ${window.start} and ${shops.uninstalledAt} < ${window.end} then 1 else 0 end), 0)`;
        columns[`active${index}`] = sql<number>`coalesce(sum(case when ${shops.installedAt} < ${window.end} and (${shops.uninstalledAt} is null or ${shops.uninstalledAt} >= ${window.end}) then 1 else 0 end), 0)`;
      });
      const [row] = await getDb().select(columns).from(shops);
      chunk.forEach((_window, index) => {
        results.push({
          installs: Number(row?.[`installs${index}`] ?? 0),
          uninstalls: Number(row?.[`uninstalls${index}`] ?? 0),
          active: Number(row?.[`active${index}`] ?? 0),
        });
      });
    }
    return results;
  }

  /** Counts behind the churn and retention figures, all from one aggregate row. */
  async churnCounts(cutoff: number): Promise<ChurnCounts> {
    const all = (...conditions: SQL[]): SQL => sql`(${sql.join(conditions, sql` and `)})`;
    const real = eq(shops.isDevStore, false);
    const uninstalled = isNotNull(shops.uninstalledAt);
    const installedIn = sql`${shops.installedAt} >= ${cutoff}`;
    const uninstalledIn = sql`${shops.uninstalledAt} >= ${cutoff}`;
    const tally = (condition: SQL) => sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`;
    const [row] = await getDb()
      .select({
        total: count(),
        active: tally(isActive),
        realActive: tally(all(isActive, real)),
        devActive: tally(all(isActive, eq(shops.isDevStore, true))),
        realUninstalled: tally(all(uninstalled, real)),
        installedInPeriod: tally(installedIn),
        realInstalledInPeriod: tally(all(installedIn, real)),
        uninstalledInPeriod: tally(all(uninstalled, uninstalledIn)),
        realUninstalledInPeriod: tally(all(uninstalled, uninstalledIn, real)),
      })
      .from(shops);
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      realActive: Number(row?.realActive ?? 0),
      devActive: Number(row?.devActive ?? 0),
      realUninstalled: Number(row?.realUninstalled ?? 0),
      installedInPeriod: Number(row?.installedInPeriod ?? 0),
      realInstalledInPeriod: Number(row?.realInstalledInPeriod ?? 0),
      uninstalledInPeriod: Number(row?.uninstalledInPeriod ?? 0),
      realUninstalledInPeriod: Number(row?.realUninstalledInPeriod ?? 0),
    };
  }

  /** Newest installs first, filtered and LIMITed in SQL. */
  async directory(query: DirectoryQuery): Promise<DirectoryRow[]> {
    const planFilter =
      query.planHandles && query.planHandles.length > 0
        ? inArray(planHandleOrFree, [...query.planHandles])
        : undefined;
    return getDb()
      .select(directoryColumns)
      .from(shops)
      .leftJoin(shopSubscriptions, eq(shopSubscriptions.shop, shops.shop))
      .where(and(activityPredicate(query.activity), kindPredicate(query.kind), planFilter))
      .orderBy(desc(shops.installedAt))
      .limit(query.limit);
  }

  /** Shops installed at or after `cutoff`, newest first. */
  async installedSince(cutoff: number, kind: ShopKind): Promise<DirectoryRow[]> {
    return getDb()
      .select(directoryColumns)
      .from(shops)
      .leftJoin(shopSubscriptions, eq(shopSubscriptions.shop, shops.shop))
      .where(and(gte(shops.installedAt, cutoff), kindPredicate(kind)))
      .orderBy(desc(shops.installedAt));
  }

  /** The few columns the "new ticket" shop picker needs. */
  async contacts() {
    return getDb()
      .select({
        shop: shops.shop,
        isDevStore: shops.isDevStore,
        name: shops.name,
        contactEmail: shops.contactEmail,
        email: shops.email,
        logoUrl: shops.logoUrl,
      })
      .from(shops)
      .orderBy(shops.shop);
  }
}
