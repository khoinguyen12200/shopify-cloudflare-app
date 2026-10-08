import { useState } from "react";
import {
  Badge,
  BlockStack,
  Card,
  CardContent,
  CardHeader,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  InlineStack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  type ChartConfig,
} from "ngk-dashboard";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { Inbox, Store } from "lucide-react";
import { Link } from "react-router";
import type { MerchantMonth } from "~/domain/merchant-trend";
import {
  aggregateUninstallReasons,
  filterMerchantFeedback,
  formatReason,
  type RawUninstallFeedback,
} from "~/domain/uninstall-feedback";
import { formatDateTime, formatNumber } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
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
 * Semantic chart colours for the dashboard's merchant charts.
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

const UNINSTALL_TIMELINE_CONFIG = {
  uninstalls: { label: "Uninstalls", color: "var(--chart-uninstalls)" },
} satisfies ChartConfig;

const PIE_COLORS = [
  "#2a78d6",
  "#c2410c",
  "#0e8f5f",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];

export default function DashboardCharts({
  trend,
  period,
  uninstallFeedback = [],
}: {
  trend: readonly MerchantMonth[];
  period: string;
  uninstallFeedback?: readonly RawUninstallFeedback[];
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
          total={uninstalls === 0 ? "0" : `−${formatNumber(LOCALE, uninstalls)}`}
          dataKey="uninstalls"
          config={UNINSTALLS_CONFIG}
          color="var(--color-uninstalls)"
          trend={trend}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <UninstallTimelineChart trend={trend} period={period} />
        <UninstallReasonsChart feedback={uninstallFeedback} />
      </div>

      <UninstallFeedbackList feedback={uninstallFeedback} />
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
        <Text as="p" className="text-2xl font-semibold tabular-nums">
          {figure}
        </Text>
      </InlineStack>
    </CardHeader>
  );
}

/**
 * Net installed shops at the end of each month.
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
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={32}
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

/** Line chart displaying the trend of merchant uninstalls across time. */
function UninstallTimelineChart({
  trend,
  period,
}: {
  trend: readonly MerchantMonth[];
  period: string;
}) {
  const total = trend.reduce((sum, m) => sum + m.uninstalls, 0);

  return (
    <Card>
      <ChartHeading
        title="Uninstall timeline"
        detail={`Monthly departures · ${period}`}
        figure={total === 0 ? "0" : `−${formatNumber(LOCALE, total)}`}
      />
      <CardContent className="flex min-h-64 flex-col items-center justify-center">
        {total === 0 ? (
          <EmptyState
            heading="No uninstalls recorded"
            icon={Inbox}
            className="py-8"
          >
            <p className="text-sm text-muted-foreground">
              No merchants have uninstalled during this period.
            </p>
          </EmptyState>
        ) : (
          <ChartContainer config={UNINSTALL_TIMELINE_CONFIG} className="h-64 w-full">
            <LineChart data={[...trend]} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="uninstalls"
                stroke="var(--color-uninstalls)"
                strokeWidth={2}
                dot={{ r: 4, fill: "var(--color-uninstalls)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Pie/Donut chart breaking down merchant uninstall reasons. */
function UninstallReasonsChart({
  feedback,
}: {
  feedback: readonly RawUninstallFeedback[];
}) {
  const reasons = aggregateUninstallReasons(feedback);
  const total = reasons.reduce((sum, r) => sum + r.count, 0);

  const pieConfig = Object.fromEntries(
    reasons.map((r, i) => [
      r.reason,
      { label: r.label, color: PIE_COLORS[i % PIE_COLORS.length] },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card>
      <ChartHeading
        title="Uninstall reasons"
        detail={total > 0 ? `${total} responses categorized` : "Exit survey breakdown"}
        figure={String(total)}
      />
      <CardContent className="flex min-h-64 flex-col items-center justify-center">
        {reasons.length === 0 ? (
          <EmptyState
            heading="No uninstall reasons recorded"
            icon={Inbox}
            className="py-8"
          >
            <p className="text-sm text-muted-foreground">
              No merchants have submitted an exit survey reason yet.
            </p>
          </EmptyState>
        ) : (
          <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center">
            <ChartContainer config={pieConfig} className="mx-auto h-52 w-52 shrink-0">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(val, name) =>
                        `${val} (${reasons.find((r) => r.label === name || r.reason === name)?.percentage ?? 0}%)`
                      }
                    />
                  }
                />
                <Pie
                  data={reasons}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={3}
                >
                  {reasons.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.reason}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-1 flex-col gap-2">
              {reasons.map((r, idx) => (
                <div key={r.reason} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <span className="font-medium text-foreground">{r.label}</span>
                  </div>
                  <span className="text-muted-foreground tabular-nums">
                    {r.count} ({r.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** List of written feedback comments left by departing merchants. */
function UninstallFeedbackList({
  feedback,
}: {
  feedback: readonly RawUninstallFeedback[];
}) {
  const [activeItem, setActiveItem] = useState<RawUninstallFeedback | null>(null);
  const itemsWithText = filterMerchantFeedback(feedback);

  return (
    <Card>
      <CardHeader>
        <InlineStack align="start" justify="between" gap={4}>
          <BlockStack gap={1}>
            <Text as="h2" className="font-semibold">
              Merchant exit comments
            </Text>
            <Text as="p" className="text-sm text-muted-foreground">
              Written feedback submitted by merchants upon uninstalling
            </Text>
          </BlockStack>
          <Text as="p" className="text-2xl font-semibold tabular-nums">
            {String(itemsWithText.length)}
          </Text>
        </InlineStack>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Shop</TableHead>
              <TableHead className="w-1/6">Reason</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead className="w-40 text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsWithText.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                  No merchant exit feedback submitted yet.
                </TableCell>
              </TableRow>
            ) : (
              itemsWithText.map((item) => (
                <TableRow key={item.eventId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {item.logoUrl ? (
                        <img src={item.logoUrl} alt="" className="size-5 rounded object-cover" />
                      ) : (
                        <Store className="size-5 shrink-0 text-muted-foreground" />
                      )}
                      <Link
                        to={`/internal/shops/${encodeURIComponent(item.shop)}`}
                        className="hover:underline"
                      >
                        {item.shopName ? `${item.shopName} (${item.shop})` : item.shop}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.reason ? (
                      <Badge variant="outline" className="text-xs">
                        {formatReason(item.reason)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="flex flex-col gap-1.5">
                      <p
                        className="line-clamp-3 text-sm italic text-foreground [overflow-wrap:anywhere] break-words cursor-pointer hover:text-foreground/80"
                        onClick={() => setActiveItem(item)}
                        title="Click to view full message"
                      >
                        "{item.reasonDescription}"
                      </p>
                      {(item.reasonDescription?.length ?? 0) > 80 && (
                        <button
                          type="button"
                          onClick={() => setActiveItem(item)}
                          className="self-start text-xs font-medium text-primary hover:underline cursor-pointer"
                        >
                          View full message
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDateTime(LOCALE, item.occurredAt, UTC)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={activeItem !== null} onOpenChange={(open) => { if (!open) setActiveItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Merchant exit feedback</DialogTitle>
            {activeItem && (
              <DialogDescription>
                {activeItem.shopName ? `${activeItem.shopName} (${activeItem.shop})` : activeItem.shop} · {formatDateTime(LOCALE, activeItem.occurredAt, UTC)}
              </DialogDescription>
            )}
          </DialogHeader>
          {activeItem && (
            <div className="flex flex-col gap-4 py-2">
              {activeItem.reason && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Reason:</span>
                  <Badge variant="outline">{formatReason(activeItem.reason)}</Badge>
                </div>
              )}
              <div className="max-h-72 overflow-y-auto rounded-md bg-muted/40 p-4 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] whitespace-pre-wrap italic">
                "{activeItem.reasonDescription}"
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
