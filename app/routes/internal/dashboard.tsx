import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import {
  BlockStack,
  Card,
  CardContent,
  InlineStack,
  Page,
  StatCard,
  Text,
} from "ngk-dashboard";
import { Store, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { requireAdminUser } from "~/services/admin-auth.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { ShopRepo } from "~/models/shops.server";
import { useLocale } from "~/i18n/useLocale";
import { formatNumber } from "~/i18n/format";

export const handle = { i18n: ["common", "internal"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireAdminUser(request);

  // Two counts every app's console wants on day one. Add your own panels here —
  // this page is a starting point, not a finished dashboard.
  const [admins, shops] = await Promise.all([
    new AdminUserRepo().countAll(),
    new ShopRepo().countInstalled(),
  ]);

  return { user, admins, shops };
};

export default function Dashboard() {
  const { user, admins, shops } = useLoaderData<typeof loader>();
  const { t } = useTranslation("internal");
  const locale = useLocale();

  return (
    <Page title={t("dashboard.heading")} subtitle={t("dashboard.welcome", { name: user.name })}>
      <BlockStack gap={4}>
        <InlineStack gap={4} className="flex-wrap [&>*]:min-w-48 [&>*]:flex-1">
          <StatCard
            label={t("dashboard.stats.admins")}
            // Formatted, never String(n): grouping separators differ by locale.
            value={formatNumber(locale, admins)}
            icon={Users}
          />
          <StatCard
            label={t("dashboard.stats.activeShops")}
            value={formatNumber(locale, shops)}
            icon={Store}
          />
        </InlineStack>

        <Card>
          <CardContent className="pt-6">
            <Text as="p" className="text-muted-foreground">
              {t("dashboard.empty")}
            </Text>
          </CardContent>
        </Card>
      </BlockStack>
    </Page>
  );
}
