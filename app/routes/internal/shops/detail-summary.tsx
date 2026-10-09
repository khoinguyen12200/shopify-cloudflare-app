import { Form } from "react-router";
import { Badge, Button, Card, CardContent, Text } from "ngk-dashboard";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

interface SummaryShop {
  readonly contactEmail: string | null;
  readonly email: string | null;
  readonly uninstalledAt: number | null;
  readonly installedAt: number;
  readonly isDevStore: boolean;
}

export function ReconciliationFailureCard({
  failureDetail,
  failureCode,
}: {
  failureDetail: string | null;
  failureCode: string | null;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Text as="p" className="font-medium text-destructive">Partner reconciliation failed</Text>
        <Text as="p" className="mt-1 text-sm text-muted-foreground">
          {failureDetail ?? failureCode ?? "Unknown Partner API failure"}
        </Text>
      </CardContent>
    </Card>
  );
}

function StoreTypeControl({ isDevStore }: { isDevStore: boolean }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      {isDevStore ? (
        <Badge variant="secondary">Development Store</Badge>
      ) : (
        <Badge variant="outline">Production Store</Badge>
      )}
      <Form method="post">
        <input type="hidden" name="intent" value="toggle_dev_status" />
        <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs">
          {isDevStore ? "Mark Production" : "Mark Dev"}
        </Button>
      </Form>
    </div>
  );
}

export function ShopSummaryCard({ shop }: { shop: SummaryShop }) {
  const contact = shop.contactEmail || shop.email;
  return (
    <Card>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
        <div>
          <Text as="p" className="text-xs text-muted-foreground">
            Status
          </Text>
          <Badge variant={shop.uninstalledAt === null ? "outline" : "destructive"}>
            {shop.uninstalledAt === null ? "Active" : "Uninstalled"}
          </Badge>
          {contact ? (
            <Text as="p" className="text-xs text-muted-foreground mt-1.5 truncate">
              {contact}
            </Text>
          ) : null}
        </div>
        <div>
          <Text as="p" className="text-xs text-muted-foreground">
            Store Type (Revenue Tracking)
          </Text>
          <StoreTypeControl isDevStore={shop.isDevStore} />
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
  );
}
