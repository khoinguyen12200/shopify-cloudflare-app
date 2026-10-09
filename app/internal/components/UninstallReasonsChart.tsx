import {
  Card,
  CardContent,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  EmptyState,
  type ChartConfig,
} from "ngk-dashboard";
import { Cell, Pie, PieChart } from "recharts";
import { Inbox } from "lucide-react";
import {
  aggregateUninstallReasons,
  type RawUninstallFeedback,
} from "~/domain/uninstall-feedback";
import { ChartHeading } from "./ChartHeading";

const PIE_COLORS = [
  "#2a78d6",
  "#c2410c",
  "#0e8f5f",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];

type Reason = ReturnType<typeof aggregateUninstallReasons>[number];

/** Pie/Donut chart breaking down merchant uninstall reasons. */
export function UninstallReasonsChart({
  feedback,
}: {
  feedback: readonly RawUninstallFeedback[];
}) {
  const reasons = aggregateUninstallReasons(feedback);
  const total = reasons.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card>
      <ChartHeading
        title="Uninstall reasons"
        detail={total > 0 ? `${total} responses categorized` : "Exit survey breakdown"}
        figure={String(total)}
      />
      <CardContent className="flex min-h-64 flex-col items-center justify-center">
        {reasons.length === 0 ? <NoReasons /> : <ReasonsBreakdown reasons={reasons} />}
      </CardContent>
    </Card>
  );
}

function NoReasons() {
  return (
    <EmptyState heading="No uninstall reasons recorded" icon={Inbox} className="py-8">
      <p className="text-sm text-muted-foreground">
        No merchants have submitted an exit survey reason yet.
      </p>
    </EmptyState>
  );
}

function ReasonsBreakdown({ reasons }: { reasons: readonly Reason[] }) {
  return (
    <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-center">
      <ReasonsPie reasons={reasons} />
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
  );
}

function ReasonsPie({ reasons }: { reasons: readonly Reason[] }) {
  const pieConfig = Object.fromEntries(
    reasons.map((r, i) => [
      r.reason,
      { label: r.label, color: PIE_COLORS[i % PIE_COLORS.length] },
    ]),
  ) satisfies ChartConfig;

  return (
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
          data={[...reasons]}
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
  );
}
