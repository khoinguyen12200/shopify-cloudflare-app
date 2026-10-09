import { shopifyEvents, adminSessionUsers } from "~/wiring.server";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Subscriptions · Staff Console" },
];
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Page,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ngk-dashboard";
import { Receipt } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { Deferred, TableSkeleton } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
import { planForShopifyHandle } from "~/billing/plans";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

/** How many rows of history to show before this needs its own pagination. */
const RECENT_LIMIT = 200;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminSessionUsers() });
  return {
    events: streamRegion("subscriptions", "events", shopifyEvents().listRecentSubscriptionEvents(RECENT_LIMIT)),
  };
};

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

type SubscriptionEvent = Awaited<Awaited<ReturnType<typeof loader>>["events"]>[number];

export default function Subscriptions() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Subscriptions"
      subtitle="Every plan change Shopify has told this app about, across every shop."
      fullWidth
    >
      <Deferred resolve={events} fallback={<TableSkeleton rows={10} columns={4} />} errorTitle="Subscription history">
        {(resolved) =>
          resolved.length === 0 ? (
            <EmptyState heading="No subscription activity yet" icon={Receipt}>
              It shows up after Partner history records subscription activity.
            </EmptyState>
          ) : (
            <SubscriptionsTable events={resolved} />
          )
        }
      </Deferred>
    </Page>
  );
}

function SubscriptionsTable({ events }: { events: readonly SubscriptionEvent[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
          <TableHeader>
            <TableRow>
              <TableHead>Shop</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.shop}</TableCell>
                <TableCell>{planForShopifyHandle(event.planHandle)?.name ?? event.planHandle ?? "Free"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_TONE[event.status]}>{STATUS_LABEL[event.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(LOCALE, event.occurredAt, UTC)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
