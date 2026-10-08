import { shops, shopifyEvents, shopSyncCheckpoints, webhookDeliveryRepository } from "~/wiring.server";
import { Form, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `${data?.shop.name ?? data?.shop.shop ?? "Shop"} · Staff Console` },
];
import {
  Badge,
  Button,
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
import { PLAN_LIST, planForShopifyHandle } from "~/billing/plans";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import {
  setShopDevStatus,
  grantShopPromoPlan,
  revokeShopPromoPlan,
  getShopPromoStatus,
} from "~/services/internal-admin/ops.server";
import { resolveEffectivePlan } from "~/domain/plan-hierarchy";
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
  const [history, relationshipEvents, deliveries, reconciliation, promoStatus] = await Promise.all([
    eventsRepo.listSubscriptionEvents(shopDomain),
    eventsRepo.listRelationshipEvents(shopDomain),
    webhookDeliveryRepository().listForShop(shopDomain),
    shopSyncCheckpoints().read(`partner_history:${shopDomain}`),
    getShopPromoStatus(shopDomain),
  ]);

  const latestSub = history[0];
  const effective = resolveEffectivePlan(
    latestSub?.planHandle,
    latestSub?.status,
    promoStatus.activeGrant,
    PLAN_LIST,
  );

  const promoAvailablePlans = PLAN_LIST
    .filter((p) => p.priceMonthly.amount > 0)
    .map((p) => ({ handle: p.handle, name: p.name }));

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

  const now = Date.now();
  return { shop, history, events, reconciliation, promoStatus, effective, promoAvailablePlans, now };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminUsers() });
  const shopDomain = decodeURIComponent(params.shop ?? "");
  const shop = await shops().get(shopDomain);
  if (!shop) throw new Response("Not found", { status: 404 });

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "toggle_dev_status") {
    await setShopDevStatus(shopDomain, !shop.isDevStore);
  } else if (intent === "grant_promo") {
    const planHandle = String(form.get("planHandle") ?? "");
    const durationDays = Number(form.get("durationDays") ?? 7);
    const reason = String(form.get("reason") ?? "");
    await grantShopPromoPlan(shopDomain, {
      planHandle,
      durationDays,
      reason,
      grantedBy: user.email,
    });
  } else if (intent === "revoke_promo") {
    const grantId = String(form.get("grantId") ?? "");
    await revokeShopPromoPlan(shopDomain, grantId, user.email);
  }

  return null;
};

export default function ShopDetail() {
  const {
    shop,
    history,
    events,
    reconciliation,
    promoStatus = { activeGrant: null, history: [] },
    effective = { planHandle: "free", source: "organic", activePromo: null },
    promoAvailablePlans = [],
    now = 0,
  } = useLoaderData<typeof loader>();

  return (
    <Page
      title={shop.name ? `${shop.name} (${shop.shop})` : shop.shop}
      subtitle={shop.contactEmail || shop.email ? `Merchant Contact: ${shop.contactEmail || shop.email}` : "Install history and subscription activity."}
      fullWidth
    >
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
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Status
              </Text>
              <Badge variant={shop.uninstalledAt === null ? "outline" : "destructive"}>
                {shop.uninstalledAt === null ? "Active" : "Uninstalled"}
              </Badge>
              {shop.contactEmail || shop.email ? (
                <Text as="p" className="text-xs text-muted-foreground mt-1.5 truncate">
                  {shop.contactEmail || shop.email}
                </Text>
              ) : null}
            </div>
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Store Type (Revenue Tracking)
              </Text>
              <div className="flex items-center gap-2 mt-1">
                {shop.isDevStore ? (
                  <Badge variant="secondary">Development Store</Badge>
                ) : (
                  <Badge variant="outline">Production Store</Badge>
                )}
                <Form method="post">
                  <input type="hidden" name="intent" value="toggle_dev_status" />
                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    {shop.isDevStore ? "Mark Production" : "Mark Dev"}
                  </Button>
                </Form>
              </div>
            </div>
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Installed
              </Text>
              <Text as="p">{formatDateTime(LOCALE, shop.installedAt, UTC)}</Text>
            </div>
            <div>
              <Text as="p" className="text-xs text-muted-foreground">
                Uninstalled
              </Text>
              <Text as="p">
                {shop.uninstalledAt === null
                  ? "—"
                  : formatDateTime(LOCALE, shop.uninstalledAt, UTC)}
              </Text>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <Text as="h2" className="text-base font-semibold">
                    Promotional Plan Overrides
                  </Text>
                  <Text as="p" className="text-sm text-muted-foreground">
                    Grant temporary comped plan access with auto-expiry. Organic higher-tier plans take precedence.
                  </Text>
                </div>
                <div>
                  {effective.source === "promo" ? (
                    <Badge variant="secondary" className="font-semibold">
                      {`Promo Active: ${effective.planHandle.toUpperCase()} (${effective.activePromo?.remainingDays}d left)`}
                    </Badge>
                  ) : effective.activePromo ? (
                    <Badge variant="outline">
                      {`Paid Plan Active: ${effective.planHandle.toUpperCase()} (Promo ${effective.activePromo.planHandle.toUpperCase()} superseded)`}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No Active Promo</Badge>
                  )}
                </div>
              </div>

              {shop.uninstalledAt === null && (
                <Form method="post" className="flex flex-wrap items-end gap-3 pt-3 border-t">
                  <input type="hidden" name="intent" value="grant_promo" />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="planHandle" className="text-xs font-medium text-muted-foreground">
                      Promo Plan
                    </label>
                    <select
                      id="planHandle"
                      name="planHandle"
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    >
                      {promoAvailablePlans.map((p) => (
                        <option key={p.handle} value={p.handle}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="durationDays" className="text-xs font-medium text-muted-foreground">
                      Duration
                    </label>
                    <select
                      id="durationDays"
                      name="durationDays"
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      defaultValue="10"
                    >
                      <option value="3">3 Days</option>
                      <option value="7">7 Days</option>
                      <option value="10">10 Days</option>
                      <option value="14">14 Days</option>
                      <option value="30">30 Days</option>
                      <option value="90">90 Days</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                    <label htmlFor="reason" className="text-xs font-medium text-muted-foreground">
                      Reason / Justification
                    </label>
                    <input
                      type="text"
                      id="reason"
                      name="reason"
                      placeholder="e.g., VIP Demo, Retention goodwill, Extended trial"
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    />
                  </div>

                  <Button type="submit" size="sm" className="h-9">
                    Grant Promo
                  </Button>
                </Form>
              )}

              {promoStatus.history.length > 0 && (
                <div className="overflow-x-auto pt-2">
                  <Table className="[&_th]:h-9 [&_th]:px-3 [&_td]:px-3 [&_td]:py-2 text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Granted By</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promoStatus.history.map((grant) => {
                        const isExpired = now >= grant.expiresAt;
                        const isRevoked = grant.revokedAt !== null;
                        const isActive = !isExpired && !isRevoked && now >= grant.startsAt;

                        return (
                          <TableRow key={grant.id}>
                            <TableCell className="font-medium">{grant.planHandle.toUpperCase()}</TableCell>
                            <TableCell>
                              {isActive ? (
                                <Badge variant="secondary" className="text-xs">Active</Badge>
                              ) : isRevoked ? (
                                <Badge variant="destructive" className="text-xs">Revoked</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Expired</Badge>
                              )}
                            </TableCell>
                            <TableCell className="max-w-xs truncate text-muted-foreground">{grant.reason}</TableCell>
                            <TableCell className="text-muted-foreground">{grant.grantedBy}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDateTime(LOCALE, grant.expiresAt, UTC)}</TableCell>
                            <TableCell className="text-right">
                              {isActive && (
                                <Form method="post">
                                  <input type="hidden" name="intent" value="revoke_promo" />
                                  <input type="hidden" name="grantId" value={grant.id} />
                                  <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive">
                                    Revoke
                                  </Button>
                                </Form>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
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
                        <TableCell className="text-muted-foreground">{formatDateTime(LOCALE, event.occurredAt, UTC)}</TableCell>
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
                        {formatDateTime(LOCALE, event.occurredAt, UTC)}
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
