import { Link } from "react-router";
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
} from "ngk-dashboard";
import { Store } from "lucide-react";
import { formatDate } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import type { loader } from "./index";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

type ShopListItem = Awaited<Awaited<ReturnType<typeof loader>>["shops"]>[number];

function ShopIdentity({ shop }: { shop: ShopListItem }) {
  return (
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
          prefetch="intent"
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
  );
}

function ShopRow({ shop }: { shop: ShopListItem }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <ShopIdentity shop={shop} />
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
  );
}

export function ShopsTable({ shops }: { shops: readonly ShopListItem[] }) {
  return (
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
              <ShopRow key={shop.shop} shop={shop} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
