import { Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Shops · Staff Console" },
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
import { Store } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminSessionUsers } from "~/wiring.server";
import { formatDate } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import { listShopsDirectory } from "~/services/internal-admin/ops.server";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminSessionUsers() });
  const directory = await listShopsDirectory({ limit: 1_000 });

  return {
    shops: directory.map((shop) => ({
      shop: shop.shop,
      name: shop.name,
      email: shop.contactEmail || shop.email,
      logoUrl: shop.logoUrl || `https://${shop.shop}/favicon.ico`,
      installedAt: shop.installedAt,
      active: shop.uninstalledAt === null,
      isDevStore: shop.isDevStore,
      planName: shop.planName,
    })),
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
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Installed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => (
                  <TableRow key={shop.shop}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground overflow-hidden border border-border/40">
                          {shop.logoUrl ? (
                            <img
                              src={shop.logoUrl}
                              alt=""
                              className="size-5 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <Store className="size-4" />
                          )}
                        </div>
                        <div>
                          <Link
                            to={`/internal/shops/${encodeURIComponent(shop.shop)}`}
                            className="font-semibold text-foreground hover:underline block leading-tight"
                          >
                            {shop.name || shop.shop}
                          </Link>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{shop.shop}</span>
                            {shop.email && (
                              <>
                                <span>•</span>
                                <span>{shop.email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {shop.isDevStore ? (
                        <Badge variant="secondary" className="text-xs">Dev Store</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Production</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={shop.active ? "outline" : "destructive"}>
                        {shop.active ? "Active" : "Uninstalled"}
                      </Badge>
                    </TableCell>
                    <TableCell>{shop.planName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(LOCALE, shop.installedAt, UTC)}
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
