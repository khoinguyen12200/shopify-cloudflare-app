import { shops, shopifyEvents, shopSyncCheckpoints, webhookDeliveryRepository } from "~/wiring.server";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  Badge,
  Card,
  CardContent,
  Page,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers, refreshShopHistory, refreshShopSubscription } from "~/wiring.server";
import { getEnv } from "~/request-context.server";
import { planForShopifyHandle } from "~/billing/plans";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";

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

interface EventHistoryRow {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly occurredAt: number;
  readonly detail: string;
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminUsers() });
  const shopDomain = decodeURIComponent(params.shop ?? "");

  const shop = await shops().get(shopDomain);
  if (!shop) throw new Response("Not found", { status: 404 });

  if (shop.shopifyShopId === null || shop.lastReconciledAt === null || Date.now() - shop.lastReconciledAt > 5 * 60 * 1000) {
    await Promise.all([
      refreshShopHistory(getEnv(), shopDomain),
      refreshShopSubscription(getEnv(), shopDomain),
    ]);
  }

  const eventsRepo = shopifyEvents();
  const [history, relationshipEvents, deliveries, reconciliation] = await Promise.all([
    eventsRepo.listSubscriptionEvents(shopDomain),
    eventsRepo.listRelationshipEvents(shopDomain),
    webhookDeliveryRepository().listForShop(shopDomain),
    shopSyncCheckpoints().read(`partner_history:${shopDomain}`),
  ]);
  const events: EventHistoryRow[] = [
    ...relationshipEvents.map((event) => ({
      id: `relationship:${event.eventId}`,
      kind: "Relationship",
      status: event.eventType,
      occurredAt: event.occurredAt,
      detail: event.reasonDescription ?? event.reason ?? event.eventId,
    })),
    ...history.map((event) => ({
      id: `subscription:${event.id}`,
      kind: "Subscription",
      status: event.status,
      occurredAt: event.occurredAt,
      detail: event.planHandle ?? event.subscriptionId,
    })),
    ...deliveries.map((delivery) => ({
      id: `webhook:${delivery.id}`,
      kind: `Webhook: ${delivery.topic}`,
      status: delivery.status,
      occurredAt: delivery.receivedAt,
      detail: delivery.failureDetail ?? delivery.id,
    })),
  ].sort((left, right) => right.occurredAt - left.occurredAt);

  return { shop, history, events, reconciliation };
};

export default function ShopDetail() {
  const { shop, history, events, reconciliation } = useLoaderData<typeof loader>();

  return (
    <Page title={shop.shop} subtitle="Install history and subscription activity." fullWidth>
      <div className="flex flex-col gap-4">
        {reconciliation?.lastFailedAt && (
          <Card>
            <CardContent className="pt-6">
              <Text as="p" className="font-medium text-destructive">Partner reconciliation failed</Text>
              <Text as="p" className="mt-1 text-sm text-muted-foreground">
                {reconciliation.failureDetail ?? reconciliation.failureCode ?? "Unknown Partner API failure"}
              </Text>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Status
              </Text>
              <Badge variant={shop.uninstalledAt === null ? "outline" : "destructive"}>
                {shop.uninstalledAt === null ? "Active" : "Uninstalled"}
              </Badge>
            </div>
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Installed
              </Text>
              <Text as="p">{formatDateTime(LOCALE, shop.installedAt)}</Text>
            </div>
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Uninstalled
              </Text>
              <Text as="p">
                {shop.uninstalledAt === null
                  ? "—"
                  : formatDateTime(LOCALE, shop.uninstalledAt)}
              </Text>
            </div>
          </CardContent>
        </Card>

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
                    events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.kind}</TableCell>
                        <TableCell><Badge variant="outline">{event.status}</Badge></TableCell>
                        <TableCell className="max-w-md whitespace-normal text-muted-foreground">{event.detail}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(LOCALE, event.occurredAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

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
                  history.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">{planForShopifyHandle(event.planHandle)?.name ?? event.planHandle ?? "Free"}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TONE[event.status]}>
                          {STATUS_LABEL[event.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(LOCALE, event.occurredAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
