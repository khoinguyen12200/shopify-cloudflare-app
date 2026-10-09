import { Card } from "ngk-dashboard";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

export interface DashboardHealth {
  readonly failedWebhooks: number;
  readonly deadLetterWebhooks: number;
  readonly lifecycleEvents: number;
  readonly subscriptionEvents: number;
  readonly checkpoint: { readonly lastSucceededAt: number | null } | null;
}

function HealthStat({ label, value }: { label: string; value: number }) {
  return <div><div className="text-sm text-muted-foreground">{label}</div><div className="text-2xl font-semibold tabular-nums">{value}</div></div>;
}

export function HealthPanel({ health }: { health: DashboardHealth }) {
  return (
    <Card>
      <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <HealthStat label="Webhook failures" value={health.failedWebhooks} />
        <HealthStat label="Dead-letter webhooks" value={health.deadLetterWebhooks} />
        <HealthStat label="Lifecycle events" value={health.lifecycleEvents} />
        <HealthStat label="Subscription events" value={health.subscriptionEvents} />
      </div>
      <div className="border-t px-6 py-4 text-sm text-muted-foreground">
        Last sync: {health.checkpoint?.lastSucceededAt
          ? formatDateTime(LOCALE, health.checkpoint.lastSucceededAt, UTC)
          : "Not yet completed"}
      </div>
    </Card>
  );
}

export function HealthSkeleton() {
  return <Card aria-hidden className="h-32 animate-pulse bg-muted/40" />;
}

/**
 * Placeholders at the exact heights of the charts they stand in for, so the
 * page does not jump when the real ones arrive. `aria-hidden` because they say
 * nothing a screen reader needs; the headings inside the charts do that.
 */
export function ChartsSkeleton() {
  return (
    <div aria-hidden className="contents">
      <Card className="h-96 animate-pulse bg-muted/40" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-80 animate-pulse bg-muted/40" />
        <Card className="h-80 animate-pulse bg-muted/40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-80 animate-pulse bg-muted/40" />
        <Card className="h-80 animate-pulse bg-muted/40" />
      </div>
      <Card className="h-64 animate-pulse bg-muted/40" />
    </div>
  );
}
