import { Badge, BlockStack, Card, CardContent, CardHeader, InlineStack, Text } from "ngk-dashboard";
import { formatNumber } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import type { RecentRun } from "./purposes";

const LOCALE: Locale = "en";

function RunRow({ run }: { run: RecentRun }) {
  return (
    <InlineStack gap={3} align="center" className="text-sm">
      <Badge variant={run.status === "ok" ? "outline" : "destructive"}>
        {run.status === "ok" ? "ok" : (run.reasonCode ?? "error")}
      </Badge>
      <span className="font-medium">{run.feature}</span>
      <span className="truncate text-muted-foreground">{run.modelId}</span>
      <span className="ml-auto whitespace-nowrap tabular-nums text-muted-foreground">
        {formatNumber(LOCALE, run.tokens)} tok
        {run.latencyMs === null ? "" : ` · ${formatNumber(LOCALE, run.latencyMs)} ms`}
      </span>
    </InlineStack>
  );
}

export function RecentCallsCard({ runs }: { runs: readonly RecentRun[] }) {
  return (
    <Card>
      <CardHeader>
        <Text as="h2" className="font-semibold">
          Recent calls
        </Text>
        <Text as="p" className="text-sm text-muted-foreground">
          Every attempt leaves a row — including the ones that failed and fell through.
        </Text>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <Text as="p" className="text-sm text-muted-foreground">
            Nothing yet.
          </Text>
        ) : (
          <BlockStack gap={2}>
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </BlockStack>
        )}
      </CardContent>
    </Card>
  );
}
