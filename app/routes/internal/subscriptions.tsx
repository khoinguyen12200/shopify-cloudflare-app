import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
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
import { adminUsers } from "~/wiring.server";
import { ShopifyEventRepo } from "~/models/shopify-events.server";
import { planForShopifyHandle } from "~/billing/plans";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

/** How many rows of history to show before this needs its own pagination. */
const RECENT_LIMIT = 200;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminUsers() });
  const events = await new ShopifyEventRepo().listRecentSubscriptionEvents(RECENT_LIMIT);
  return { events };
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

export default function Subscriptions() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Subscriptions"
      subtitle="Every plan change Shopify has told this app about, across every shop."
      fullWidth
    >
      {events.length === 0 ? (
        <EmptyState
          heading="No subscription activity yet"
          icon={Receipt}
        >
          It shows up after Partner history records subscription activity.
        </EmptyState>
      ) : (
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
                      <Badge variant={STATUS_TONE[event.status]}>
                        {STATUS_LABEL[event.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(LOCALE, event.occurredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
