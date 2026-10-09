import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "ngk-dashboard";
import { planForShopifyHandle } from "~/billing/plans";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";
import type { EventHistoryRow } from "./detail-events";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  CANCELLATION_SCHEDULED: "Cancellation scheduled",
  CANCELED: "Canceled",
  NONE: "Free",
  UNKNOWN: "Unknown",
  PENDING: "Pending",
  FROZEN: "Frozen",
};

const STATUS_TONE: Record<SubscriptionStatus, "success" | "warning" | "destructive" | "outline"> = {
  ACTIVE: "success",
  CANCELLATION_SCHEDULED: "warning",
  CANCELED: "destructive",
  NONE: "outline",
  UNKNOWN: "outline",
  PENDING: "warning",
  FROZEN: "warning",
};

function EventRow({ event }: { event: EventHistoryRow }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{event.kind}</TableCell>
      <TableCell><Badge variant="outline">{event.status}</Badge></TableCell>
      <TableCell className="max-w-md whitespace-normal text-muted-foreground">{event.detail}</TableCell>
      <TableCell className="text-muted-foreground">{formatDateTime(LOCALE, event.occurredAt, UTC)}</TableCell>
    </TableRow>
  );
}

export function EventHistorySection({ events }: { events: readonly EventHistoryRow[] }) {
  return (
    <section aria-labelledby="event-history-heading">
      <div className="mb-3">
        <Text as="h2" id="event-history-heading" className="text-base font-semibold">
          Event history
        </Text>
        <Text as="p" className="text-sm text-muted-foreground">
          Immutable relationship, subscription, and webhook delivery records.
        </Text>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No event records for this shop yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => <EventRow key={event.id} event={event} />)
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

interface SubscriptionHistoryItem {
  readonly id: string;
  readonly planHandle: string | null;
  readonly status: SubscriptionStatus;
  readonly occurredAt: number;
}

function SubscriptionRow({ event }: { event: SubscriptionHistoryItem }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{planForShopifyHandle(event.planHandle)?.name ?? event.planHandle ?? "Free"}</TableCell>
      <TableCell>
        <Badge variant={STATUS_TONE[event.status]}>
          {STATUS_LABEL[event.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDateTime(LOCALE, event.occurredAt, UTC)}
      </TableCell>
    </TableRow>
  );
}

export function SubscriptionHistoryCard({ history }: { history: readonly SubscriptionHistoryItem[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No subscription activity for this shop yet.
                </TableCell>
              </TableRow>
            ) : (
              history.map((event) => <SubscriptionRow key={event.id} event={event} />)
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
