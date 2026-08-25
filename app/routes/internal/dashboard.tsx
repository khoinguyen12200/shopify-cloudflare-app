import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  BlockStack,
  Card,
  CardContent,
  CardHeader,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  InlineStack,
  Page,
  StatCard,
  Text,
  type ChartConfig,
} from "ngk-dashboard";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { CircleDollarSign, Crown, Store, Users } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { ShopRepo } from "~/models/shops.server";
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import { computeBillingStats } from "~/billing/dashboard-stats";
import { installsByMonth } from "~/billing/install-trend";
import { formatMoney, toCurrency, zero } from "~/money";
import { unwrap } from "~/lib/result";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";
/** Only used when nobody has paid yet — there's no real currency to show, so USD is a display default, not a business decision. */
const NO_REVENUE = zero(unwrap(toCurrency("USD")));

const TREND_MONTHS = 6;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireAdminUser(request);

  const [admins, allShops, latestPerShop] = await Promise.all([
    new AdminUserRepo().countAll(),
    new ShopRepo().listAll(),
    new SubscriptionEventRepo().latestPerShop(),
  ]);

  const activeShops = allShops.filter((shop) => shop.uninstalledAt === null);

  return {
    user,
    admins,
    stats: computeBillingStats(activeShops, latestPerShop),
    trend: installsByMonth(allShops, TREND_MONTHS, Date.now()),
  };
};

const chartConfig = {
  count: { label: "New installs", color: "var(--chart-1)" },
} satisfies ChartConfig;

export default function Dashboard() {
  const { user, admins, stats, trend } = useLoaderData<typeof loader>();

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
          <CardHeader>
            <Text as="h2" className="font-semibold">
              New installs
            </Text>
            <Text as="p" className="text-sm text-muted-foreground">
              Last {TREND_MONTHS} months
            </Text>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={trend}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </BlockStack>
    </Page>
  );
}
