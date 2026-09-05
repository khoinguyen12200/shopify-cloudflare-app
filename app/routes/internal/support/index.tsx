import { shopSubscriptions } from "~/wiring.server";
import { Link, useLoaderData, useNavigation, useSubmit } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Badge,
  BlockStack,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Page,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "ngk-dashboard";
import { LifeBuoy } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { supportService } from "~/wiring.server";
import { planForShopifyHandle } from "~/billing/plans";
import { isUnreadFor, statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_EN } from "~/support/categories";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const PAID_STATUSES = new Set(["ACTIVE", "CANCELLATION_SCHEDULED"]);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const actor = await requireAdminUser(request, { users: adminUsers() });

  const [tickets, currentSubscriptions] = await Promise.all([
    supportService().listOpenForStaff(),
    shopSubscriptions().listCurrent(),
  ]);
  const currentByShop = new Map(currentSubscriptions.map((subscription) => [subscription.shop, subscription]));

  return {
    notifySupport: actor.notifySupport,
    tickets: tickets.map((ticket) => {
      const current = currentByShop.get(ticket.shop);
      const paid = current && PAID_STATUSES.has(current.status) ? current : undefined;
      return {
        id: ticket.id,
        shop: ticket.shop,
        shopName: ticket.shopName,
        subject: ticket.subject,
        category: ticket.category,
        status: statusOf(ticket),
        lastMessageAt: ticket.lastMessageAt,
        planName: planForShopifyHandle(paid?.planHandle)?.name ?? (paid?.planHandle ?? "Free"),
        unread: isUnreadFor({
          lastMessageAt: ticket.lastMessageAt,
          lastReadAt: ticket.staffLastReadAt,
        }),
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireAdminUser(request, { users: adminUsers() });
  const form = await request.formData();

  // The only action here is the signed-in person's own preference, so there is
  // no id to trust from the form — it is always the actor's own row.
  await adminUsers().setNotifySupport(
    actor.id,
    form.get("notifySupport") === "on",
    Date.now(),
  );
  return { saved: true as const };
};

/** From the STAFF side, "open" is the one that needs work — hence the alarm. */
const STATUS_TONE: Record<SupportStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  answered: "secondary",
  closed: "outline",
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Needs reply",
  answered: "Waiting on merchant",
  closed: "Closed",
};

export default function InternalSupport() {
  const { tickets, notifySupport } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const busy = navigation.state !== "idle";

  return (
    <Page
      title="Support"
      subtitle="Open tickets from every shop, most recent first."
      fullWidth
    >
      <BlockStack gap={4}>
        <Card>
          <CardHeader>
            <Text as="h2" className="font-semibold">
              Email me about tickets
            </Text>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              {/* One switch for the signed-in person's own preference, so it
                  submits on change rather than needing a save button. */}
              <Switch
                defaultChecked={notifySupport}
                disabled={busy}
                onCheckedChange={(checked) => {
                  void submit(
                    { notifySupport: checked ? "on" : "off" },
                    { method: "post" },
                  );
                }}
              />
              <Text as="p" className="text-sm text-muted-foreground">
                Send me an email when a merchant opens or replies to a ticket.
                Only active accounts are ever emailed.
              </Text>
            </div>
          </CardContent>
        </Card>

        {tickets.length === 0 ? (
          <EmptyState heading="No open tickets" icon={LifeBuoy}>
            When a merchant files a ticket from their admin, it lands here.
          </EmptyState>
        ) : (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        <Link
                          to={`/internal/support/${ticket.id}`}
                          prefetch="intent"
                          className="underline"
                        >
                          {ticket.subject}
                        </Link>
                        {ticket.unread && (
                          <Badge variant="default" className="ml-2">
                            New
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {ticket.shopName || ticket.shop}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{ticket.planName}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {CATEGORY_LABEL_EN[ticket.category]}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TONE[ticket.status]}>
                          {STATUS_LABEL[ticket.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(LOCALE, ticket.lastMessageAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
