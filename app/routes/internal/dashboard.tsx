import { operationalHealth, shops, shopSubscriptions } from "~/wiring.server";
import { Suspense, lazy, useSyncExternalStore } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { BlockStack, Card, InlineStack, Page, StatCard } from "ngk-dashboard";
import { CircleDollarSign, Crown, Store, Users } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { computeBillingStats } from "~/billing/dashboard-stats";
import { merchantTrend } from "~/domain/merchant-trend";
import { formatMoney, toCurrency, zero } from "~/money";
import { formatDateTime } from "~/i18n/format";
import { unwrap } from "~/lib/result";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";
/** Only used when nobody has paid yet — there's no real currency to show, so USD is a display default, not a business decision. */
const NO_REVENUE = zero(unwrap(toCurrency("USD")));

/** A full year, so seasonality is visible and one quiet month is not a trend. */
const TREND_MONTHS = 12;

/**
 * Recharts and the three charts built on it are the heaviest thing this console
 * ships, and none of it is needed to paint the page. Split into its own chunk,
 * requested only in the browser (see `useMountedCharts`), so the stat cards —
 * which are what a staff member usually opens this page for — render
 * immediately instead of waiting on a charting library.
 */
const DashboardCharts = lazy(() => import("~/internal/components/DashboardCharts"));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminUsers() });

  const [admins, allShops, currentSubscriptions, health] = await Promise.all([
    adminUsers().countAll(),
    shops().listAll(),
    shopSubscriptions().listCurrent(),
    operationalHealth().read(),
  ]);

  const activeShops = allShops.filter((shop) => shop.uninstalledAt === null);
  const currentByShop = new Map<string, typeof currentSubscriptions>();
  for (const subscription of currentSubscriptions) {
    const rows = currentByShop.get(subscription.shop) ?? [];
    rows.push(subscription);
    currentByShop.set(subscription.shop, rows);
  }

  return {
    user,
    admins,
    stats: computeBillingStats(activeShops.flatMap((shop) => {
      const subscriptions = currentByShop.get(shop.shop) ?? [null];
      return subscriptions.map((subscription) => ({
        shop: shop.shop,
        relationshipStatus: shop.relationshipStatus,
        subscriptionStatus: subscription?.status ?? null,
        billingInterval: subscription?.billingInterval ?? null,
        priceAmount: subscription?.priceAmount ?? null,
        priceCurrency: subscription?.priceCurrency ?? null,
      }));
    })),
    trend: merchantTrend(allShops, TREND_MONTHS, Date.now()),
    health,
  };
};

export default function Dashboard() {
  const { user, admins, stats, trend, health } = useLoaderData<typeof loader>();
  const showCharts = useMountedCharts();

  return (
    <Page title="Dashboard" subtitle={`Signed in as ${user.name}`} fullWidth>
      <BlockStack gap={4}>
        <InlineStack gap={4} className="flex-wrap [&>*]:min-w-48 [&>*]:flex-1">
          <StatCard label="Admin accounts" value={String(admins)} icon={Users} />
          <StatCard label="Installed shops" value={String(stats.totalShops)} icon={Store} />
          <StatCard label="Paid shops" value={String(stats.paidShops)} icon={Crown} />
          <StatCard label="Free shops" value={String(stats.freeShops)} icon={Store} />
          <StatCard
            label="Monthly recurring revenue"
            value={
              stats.mrrByCurrency.length === 0
                ? formatMoney(LOCALE, NO_REVENUE)
                : stats.mrrByCurrency.map((m) => formatMoney(LOCALE, m)).join(" + ")
            }
            icon={CircleDollarSign}
          />
        </InlineStack>

        <Card>
          <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <HealthStat label="Webhook failures" value={health.failedWebhooks} />
            <HealthStat label="Dead-letter webhooks" value={health.deadLetterWebhooks} />
            <HealthStat label="Lifecycle events" value={health.lifecycleEvents} />
            <HealthStat label="Subscription events" value={health.subscriptionEvents} />
          </div>
          <div className="border-t px-6 py-4 text-sm text-muted-foreground">
            Last sync: {health.checkpoint?.lastSucceededAt
              ? formatDateTime(LOCALE, health.checkpoint.lastSucceededAt)
              : "Not yet completed"}
          </div>
        </Card>

        {showCharts ? (
          <Suspense fallback={<ChartsSkeleton />}>
            <DashboardCharts trend={trend} period={`Last ${TREND_MONTHS} months`} />
          </Suspense>
        ) : (
          <ChartsSkeleton />
        )}
      </BlockStack>
    </Page>
  );
}

function HealthStat({ label, value }: { label: string; value: number }) {
  return <div><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums">{value}</div></div>;
}

/** Never changes, so the subscribe callback is a stable no-op. */
const neverChanges = () => () => {};

/**
 * False while rendering on the server and while hydrating, true once mounted.
 *
 * Deliberately NOT just `<Suspense>`: React resolves a lazy component during
 * SSR too, which would put recharts back in the server render and back on the
 * critical path for hydration. Gating keeps the chunk request in the browser,
 * after paint.
 *
 * `useSyncExternalStore` rather than a `useState` + `useEffect` mount flag:
 * it is the API that exists precisely to give the server and the client
 * different snapshots of the same value, so hydration cannot mismatch — and
 * writing state from inside an effect is a lint error here for good reason.
 */
function useMountedCharts(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true, // client
    () => false, // server, and the hydrating pass
  );
}

/**
 * Placeholders at the exact heights of the charts they stand in for, so the
 * page does not jump when the real ones arrive. `aria-hidden` because they say
 * nothing a screen reader needs; the headings inside the charts do that.
 */
function ChartsSkeleton() {
  return (
    <div aria-hidden className="contents">
      <Card className="h-96 animate-pulse bg-muted/40" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-80 animate-pulse bg-muted/40" />
        <Card className="h-80 animate-pulse bg-muted/40" />
      </div>
    </div>
  );
}
