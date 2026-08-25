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
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import { storedEventPrice } from "~/billing/subscription-event";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import { formatMoney } from "~/money";
import type { SubscriptionStatus } from "~/db/schema";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

/** How many rows of history to show before this needs its own pagination. */
const RECENT_LIMIT = 200;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request);
  const events = await new SubscriptionEventRepo().listRecent(RECENT_LIMIT);
  return { events };
};

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: "Active",
  ACCEPTED: "Accepted",
  PENDING: "Pending approval",
  FROZEN: "Frozen",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
  EXPIRED: "Expired",
};

const STATUS_TONE: Record<SubscriptionStatus, "success" | "warning" | "destructive" | "outline"> = {
  ACTIVE: "success",
  ACCEPTED: "success",
  PENDING: "warning",
  FROZEN: "warning",
  CANCELLED: "destructive",
  DECLINED: "destructive",
  EXPIRED: "outline",
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
          It shows up here the first time a merchant subscribes, once the
          app_subscriptions/update webhook is receiving live traffic.
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
                  <TableHead>Price</TableHead>
                  <TableHead>Changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.shop}</TableCell>
                    <TableCell>{event.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[event.status]}>
                        {STATUS_LABEL[event.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatMoney(LOCALE, storedEventPrice(event))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(LOCALE, event.shopifyUpdatedAt)}
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
