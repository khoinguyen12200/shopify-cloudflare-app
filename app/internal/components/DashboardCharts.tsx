import {
  BlockStack,
  Card,
  CardContent,
  CardHeader,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  InlineStack,
  Text,
  type ChartConfig,
} from "ngk-dashboard";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { MerchantMonth } from "~/domain/merchant-trend";
import { formatNumber } from "~/i18n/format";
import type { Locale } from "~/i18n/config";

/**
 * Every chart on the dashboard, in ONE module with a default export, so
 * `lazy(() => import(...))` pulls recharts into a chunk of its own.
 *
 * Recharts is by far the heaviest thing the console renders, and none of it is
 * needed to paint the page: the stat cards above carry the numbers a staff
 * member usually opens this page for. Splitting it here is what lets the
 * dashboard render immediately and fill the charts in a moment later — see the
 * client-only mount in routes/internal/dashboard.tsx.
 *
 * The internal console is staff-only and English-only, so no i18n.
 */
const LOCALE: Locale = "en";

/**
 * One series per chart, so each chart's own title carries the identity and no
 * legend is needed. The colours are the validated semantic tokens from
 * app/styles/internal/internal.tailwind.css — never `--chart-1..5`, which do
 * not hold a hue across light and dark.
 */
const GROWTH_CONFIG = {
  active: { label: "Merchants", color: "var(--chart-growth)" },
} satisfies ChartConfig;

const INSTALLS_CONFIG = {
  installs: { label: "Installs", color: "var(--chart-installs)" },
} satisfies ChartConfig;

const UNINSTALLS_CONFIG = {
  uninstalls: { label: "Uninstalls", color: "var(--chart-uninstalls)" },
} satisfies ChartConfig;

export default function DashboardCharts({
  trend,
  period,
}: {
  trend: readonly MerchantMonth[];
  period: string;
}) {
  const installs = trend.reduce((total, month) => total + month.installs, 0);
  const uninstalls = trend.reduce((total, month) => total + month.uninstalls, 0);

  return (
    <>
      {/*
        Growth leads, at full width, because it is the only one of the three
        that answers "how are we doing" on its own. Installs and uninstalls sit
        under it at half width: they are the two forces that produced the line
        above, and reading them side by side is what makes a rising install
        count with a rising churn count legible as the problem it is.
      */}
      <GrowthChart trend={trend} period={period} />

      <div className="grid gap-4 md:grid-cols-2">
        <MovementChart
          title="Installs"
          period={period}
          total={`+${formatNumber(LOCALE, installs)}`}
          dataKey="installs"
          config={INSTALLS_CONFIG}
          color="var(--color-installs)"
          trend={trend}
        />
        <MovementChart
          title="Uninstalls"
          period={period}
          // A minus sign, not a hyphen: it is a number, and the two render at
          // different widths and heights in most faces.
          total={uninstalls === 0 ? "0" : `−${formatNumber(LOCALE, uninstalls)}`}
          dataKey="uninstalls"
          config={UNINSTALLS_CONFIG}
          color="var(--color-uninstalls)"
          trend={trend}
        />
      </div>
    </>
  );
}

/** A card header: title and period on the left, the headline figure opposite. */
function ChartHeading({
  title,
  detail,
  figure,
}: {
  title: string;
  detail: string;
  figure: string;
}) {
  return (
    <CardHeader>
      <InlineStack align="start" justify="between" gap={4}>
        <BlockStack gap={1}>
          <Text as="h2" className="font-semibold">
            {title}
          </Text>
          <Text as="p" className="text-sm text-muted-foreground">
            {detail}
          </Text>
        </BlockStack>
        {/* The figure wears text tokens, never the series colour — the marks
            below already carry the identity. */}
        <Text as="p" className="text-2xl font-semibold tabular-nums">
          {figure}
        </Text>
      </InlineStack>
    </CardHeader>
  );
}

/**
 * Net installed shops at the end of each month — a level, not a rate, which is
 * why it is an area and not bars. The fill is a soft vertical gradient so the
 * 2px line stays the thing being read.
 */
function GrowthChart({
  trend,
  period,
}: {
  trend: readonly MerchantMonth[];
  period: string;
}) {
  const current = trend.at(-1)?.active ?? 0;

  return (
    <Card>
      <ChartHeading
        title="Merchant growth"
        detail={`Shops with the app still installed · ${period}`}
        figure={formatNumber(LOCALE, current)}
      />
      <CardContent>
        <ChartContainer config={GROWTH_CONFIG} className="h-72 w-full">
          <AreaChart data={[...trend]} margin={{ left: 4, right: 4, top: 4 }}>
            <defs>
              <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-active)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--color-active)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {/* Horizontal rules only: vertical ones fight the area's own edge. */}
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
              // Shop counts are whole numbers; a "2.5 shops" gridline is noise.
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              dataKey="active"
              type="monotone"
              stroke="var(--color-active)"
              strokeWidth={2}
              fill="url(#growth-fill)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

/** Installs or uninstalls: a per-month count, so bars anchored to the baseline. */
function MovementChart({
  title,
  period,
  total,
  dataKey,
  config,
  color,
  trend,
}: {
  title: string;
  period: string;
  total: string;
  dataKey: "installs" | "uninstalls";
  config: ChartConfig;
  color: string;
  trend: readonly MerchantMonth[];
}) {
  return (
    <Card>
      <ChartHeading title={title} detail={period} figure={total} />
      <CardContent>
        <ChartContainer config={config} className="h-56 w-full">
          <BarChart data={[...trend]} margin={{ left: 4, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey={dataKey} fill={color} radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
