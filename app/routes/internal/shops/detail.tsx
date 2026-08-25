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
import { ShopRepo } from "~/models/shops.server";
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import { storedEventPrice } from "~/billing/subscription-event";
import { formatDateTime } from "~/i18n/format";
import { formatMoney } from "~/money";
import type { Locale } from "~/i18n/config";
import type { SubscriptionStatus } from "~/db/schema";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

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

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireAdminUser(request);
  const shopDomain = decodeURIComponent(params.shop ?? "");

  const shop = await new ShopRepo().get(shopDomain);
  if (!shop) throw new Response("Not found", { status: 404 });

  const history = await new SubscriptionEventRepo().listForShop(shopDomain);

  return { shop, history };
};

export default function ShopDetail() {
  const { shop, history } = useLoaderData<typeof loader>();

  return (
    <Page title={shop.shop} subtitle="Install history and subscription activity." fullWidth>
      <div className="flex flex-col gap-4">
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

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
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
                      <TableCell className="font-medium">{event.name}</TableCell>
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
