import { operationalHealth, shopifyEvents, adminSessionUsers } from "~/wiring.server";
import { Suspense, lazy, useSyncExternalStore } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Dashboard · Staff Console" },
];
import { BlockStack, InlineStack, Page, StatCard } from "ngk-dashboard";
import { CircleDollarSign, Crown, Store, Users } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { loadDashboardOverview } from "~/services/internal-admin/ops.server";
import { PLAN_LIST } from "~/billing/plans";
import { formatMoney, toCurrency, zero } from "~/money";
import { ChartsSkeleton, HealthPanel, HealthSkeleton } from "./dashboard-panels";
import { Deferred, StatRowSkeleton } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
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
  // Only the auth check is awaited. Every region below is a promise, so the
  // page frame paints at once and each region streams in behind its skeleton.
  const user = await requireAdminUser(request, { users: adminSessionUsers() });

  const overview = streamRegion(
    "dashboard",
    "overview",
    loadDashboardOverview({ trendMonths: TREND_MONTHS, now: Date.now() }),
  );
  const feedback = streamRegion("dashboard", "uninstall_feedback", shopifyEvents().listAllUninstallFeedback());

  return {
    user,
    // Headline numbers: a failure here shows an error, never a plausible zero.
    headline: Promise.all([streamRegion("dashboard", "admin_count", adminUsers().countAll()), overview]).then(
      ([admins, loaded]) => ({ admins, stats: loaded.stats }),
    ),
    health: streamRegion("dashboard", "health", operationalHealth().read()),
    charts: Promise.all([overview, feedback]).then(([loaded, uninstallFeedback]) => ({
      trend: loaded.trend,
      uninstallFeedback,
    })),
  };
};

export default function Dashboard() {
  const { user, headline, health, charts } = useLoaderData<typeof loader>();

  return (
    <Page title="Dashboard" subtitle={`Signed in as ${user.name}`} fullWidth>
      <BlockStack gap={4}>
        <Deferred resolve={headline} fallback={<HeadlineSkeleton />} errorTitle="Headline numbers">
          {({ admins, stats }) => (
            <>
              <HeadlineStats admins={admins} stats={stats} />
              <PlanStats stats={stats} />
            </>
          )}
        </Deferred>
        <Deferred resolve={health} fallback={<HealthSkeleton />} errorTitle="Operational health">
          {(resolved) => <HealthPanel health={resolved} />}
        </Deferred>
        <Deferred resolve={charts} fallback={<ChartsSkeleton />} errorTitle="Charts and exit feedback">
          {({ trend, uninstallFeedback }) => <ChartsPanel trend={trend} feedback={uninstallFeedback} />}
        </Deferred>
      </BlockStack>
    </Page>
  );
}

/** Five headline cards, then one card per plan — the same rows the data fills. */
function HeadlineSkeleton() {
  return (
    <>
      <StatRowSkeleton count={5} />
      <StatRowSkeleton count={PLAN_LIST.length} minWidth="min-w-44" />
    </>
  );
}

type Stats = Awaited<ReturnType<typeof loadDashboardOverview>>["stats"];

function HeadlineStats({ admins, stats }: { admins: number; stats: Stats }) {
  return (
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
  );
}

function PlanStats({ stats }: { stats: Stats }) {
  return (
    <InlineStack gap={4} className="flex-wrap [&>*]:min-w-44 [&>*]:flex-1">
      {PLAN_LIST.map((plan) => {
        const count = stats.shopsByPlan?.[plan.handle] ?? 0;
        const cleanName = plan.name.replace(/^TODO:/i, "");
        const title = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
        const isPaid = plan.priceMonthly.amount > 0;
        const pct = stats.totalShops > 0 ? Math.round((count / stats.totalShops) * 100) : 0;
        return (
          <StatCard
            key={plan.handle}
            label={`${title} plan`}
            value={String(count)}
            icon={isPaid ? Crown : Store}
            helpText={`${pct}% of active stores`}
          />
        );
      })}
    </InlineStack>
  );
}

type ChartsPanelProps = {
  trend: React.ComponentProps<typeof DashboardCharts>["trend"];
  feedback: React.ComponentProps<typeof DashboardCharts>["uninstallFeedback"];
};

function ChartsPanel({ trend, feedback }: ChartsPanelProps) {
  const showCharts = useMountedCharts();
  if (!showCharts) return <ChartsSkeleton />;
  return (
    <Suspense fallback={<ChartsSkeleton />}>
      <DashboardCharts trend={trend} period={`Last ${TREND_MONTHS} months`} uninstallFeedback={feedback} />
    </Suspense>
  );
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
