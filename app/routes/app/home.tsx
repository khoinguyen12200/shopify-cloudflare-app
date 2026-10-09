import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { pricingReturnDestination } from "~/billing/pricing-return";
import {
  ChannelsSection,
  PerformanceSection,
  RecentActivitySection,
} from "~/components/dashboard/DashboardSections";
import { SetupGuide } from "~/components/dashboard/SetupGuide";
import { authenticateAdmin } from "~/admin/require-merchant.server";
import { settle } from "~/admin/settle.server";
import type { Outcome } from "~/admin/outcome";
import { Deferred } from "~/components/admin/Deferred";
import { shops } from "~/wiring.server";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authentication is awaited: Shopify requires a valid session token on every
  // request, and its redirect / bounce responses must keep working.
  const { session } = await authenticateAdmin(request);

  const destination = pricingReturnDestination(request.url);
  if (destination) throw redirect(destination);

  // The layout persists the shop identity (name included) on the first load, so
  // the name is read from D1 rather than the Admin API. It only decorates the
  // greeting, so the page renders at once with the shop domain and the name
  // streams in; a failure keeps the domain (logged by `settle`).
  const shopName = settle(
    shops().get(session.shop).then((record) => record?.name ?? session.shop),
    { event: "admin.home.shop_name.failed", shop: session.shop, route: "app/home" },
  );

  return { shopDomain: session.shop, shopName };
};

const dashboardData = {
  sales: 184_260,
  orders: 328,
  customers: 214,
  conversion: 0.042,
  channels: [
    { key: "onlineStore", sales: 128_400, orders: 221 },
    { key: "shopApp", sales: 42_360, orders: 76 },
    { key: "social", sales: 13_500, orders: 31 },
  ],
};

function Greeting({ shop }: { shop: string }) {
  const { t } = useTranslation("admin");
  return <s-heading>{t("dashboard.greeting", { shop })}</s-heading>;
}

function DashboardHeader({ shopDomain, shopName }: { shopDomain: string; shopName: Promise<Outcome<string>> }) {
  const { t } = useTranslation("admin");
  return (
    <>
      <s-button slot="primary-action" variant="primary" href="/admin/discounts/new">
        {t("dashboard.primaryAction")}
      </s-button>
      <s-button slot="secondary-actions" href="/admin/analytics">
        {t("dashboard.secondaryAction")}
      </s-button>

      <s-section>
        <s-stack gap="small-200">
          <Deferred
            resolve={shopName}
            pending={<Greeting shop={shopDomain} />}
            failed={<Greeting shop={shopDomain} />}
          >
            {(name) => <Greeting shop={name} />}
          </Deferred>
          <s-paragraph>{t("dashboard.intro")}</s-paragraph>
        </s-stack>
      </s-section>
    </>
  );
}

export default function Index() {
  const { shopDomain, shopName } = useLoaderData<typeof loader>();
  const { t } = useTranslation("admin");
  const channels = [
    { ...dashboardData.channels[0], label: t("dashboard.onlineStore") },
    { ...dashboardData.channels[1], label: t("dashboard.shopApp") },
    { ...dashboardData.channels[2], label: t("dashboard.social") },
  ];

  return (
    <s-page heading={t("dashboard.heading")}>
      <DashboardHeader shopDomain={shopDomain} shopName={shopName} />
      <SetupGuide />
      <PerformanceSection metrics={dashboardData} />
      <ChannelsSection channels={channels} />
      <RecentActivitySection />

      <s-stack direction="inline" gap="base" alignItems="center">
        <s-text color="subdued">{t("dashboard.needHelp")}</s-text>
        <s-link href="/app/support">{t("dashboard.contactSupport")}</s-link>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
