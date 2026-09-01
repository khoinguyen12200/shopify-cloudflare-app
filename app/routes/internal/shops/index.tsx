import { Link, useLoaderData } from "react-router";
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
import { Store } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { ShopRepo } from "~/models/shops.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { planForShopifyHandle } from "~/billing/plans";
import { formatDate } from "~/i18n/format";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const PAID_STATUSES = new Set(["ACTIVE", "ACCEPTED"]);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request);
  const [shops, currentSubscriptions] = await Promise.all([
    new ShopRepo().listAll(),
    new ShopSubscriptionRepo().listCurrent(),
  ]);
  const currentByShop = new Map(currentSubscriptions.map((subscription) => [subscription.shop, subscription]));

  return {
    shops: shops.map((shop) => {
      const current = currentByShop.get(shop.shop);
      const paid = current && PAID_STATUSES.has(current.status) ? current : undefined;
      return {
        shop: shop.shop,
        installedAt: shop.installedAt,
        active: shop.uninstalledAt === null,
        planName: planForShopifyHandle(paid?.planHandle)?.name ?? (paid?.planHandle ?? "Free"),
      };
    }),
  };
};

export default function Shops() {
  const { shops } = useLoaderData<typeof loader>();

  return (
    <Page title="Shops" subtitle="Every shop that has ever installed this app." fullWidth>
      {shops.length === 0 ? (
        <EmptyState heading="No shops yet" icon={Store}>
          The first install writes a row here.
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Installed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => (
                  <TableRow key={shop.shop}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/internal/shops/${encodeURIComponent(shop.shop)}`}
                        className="hover:underline"
                      >
                        {shop.shop}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={shop.active ? "outline" : "destructive"}>
                        {shop.active ? "Active" : "Uninstalled"}
                      </Badge>
                    </TableCell>
                    <TableCell>{shop.planName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(LOCALE, shop.installedAt)}
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
