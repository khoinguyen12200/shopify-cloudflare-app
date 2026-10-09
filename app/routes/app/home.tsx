import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { pricingReturnDestination } from "~/billing/pricing-return";
import { formatMoney, formatNumber } from "~/i18n/format";
import { useLocale } from "~/i18n/useLocale";
import { authenticateAdmin } from "~/admin/require-merchant.server";
import { shops } from "~/wiring.server";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // The layout persists the shop identity (name included) on the first load, so
  // the name is read from D1 — one local read instead of an Admin API round trip
  // on every visit.
  const { session } = await authenticateAdmin(request);

  const destination = pricingReturnDestination(request.url);
  if (destination) throw redirect(destination);

  const record = await shops().get(session.shop);

  return {
    shopName: record?.name ?? session.shop,
    installedAt: record?.installedAt ?? null,
  };
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

type MetricCardProps = {
  label: string;
  value: string;
  change: string;
  href: string;
};

function MetricCard({ label, value, change, href }: MetricCardProps) {
  return (
    <s-clickable
      href={href}
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>{label}</s-heading>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{value}</s-text>
          <s-badge tone="success" icon="arrow-up">
            {change}
          </s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
  );
}

type GuideStepProps = {
  title: string;
  body: string;
  action: string;
  href: string;
  image: string;
  alt: string;
  expanded: boolean;
  onToggle: () => void;
  complete?: boolean;
  toggleLabel: string;
};

function GuideStep({
  title,
  body,
  action,
  href,
  image,
  alt,
  expanded,
  onToggle,
  complete = false,
  toggleLabel,
}: GuideStepProps) {
  return (
    <s-box>
      <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
        <s-checkbox label={title} checked={complete} disabled></s-checkbox>
        <s-button
          accessibilityLabel={toggleLabel}
          variant="tertiary"
          icon={expanded ? "chevron-up" : "chevron-down"}
          onClick={onToggle}
        ></s-button>
      </s-grid>
      <s-box
        padding="small"
        paddingBlockStart="none"
        display={expanded ? "auto" : "none"}
      >
        <s-box padding="base" background="subdued" borderRadius="base">
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-grid gap="small-200">
              <s-paragraph>{body}</s-paragraph>
              <s-button variant="primary" href={href}>
                {action}
              </s-button>
            </s-grid>
            <s-box maxBlockSize="80px" maxInlineSize="80px">
              <s-image
                src={image}
                alt={alt}
                objectFit="contain"
              ></s-image>
            </s-box>
          </s-grid>
        </s-box>
      </s-box>
    </s-box>
  );
}

export default function Index() {
  const { shopName } = useLoaderData<typeof loader>();
  const { t } = useTranslation("admin");
  const locale = useLocale();
  const [expanded, setExpanded] = useState({
    guide: true,
    step1: true,
    step2: false,
    step3: false,
  });
  const channels = [
    { ...dashboardData.channels[0], label: t("dashboard.onlineStore") },
    { ...dashboardData.channels[1], label: t("dashboard.shopApp") },
    { ...dashboardData.channels[2], label: t("dashboard.social") },
  ];

  return (
    <s-page heading={t("dashboard.heading")}>
      <s-button
        slot="primary-action"
        variant="primary"
        href="/admin/discounts/new"
      >
        {t("dashboard.primaryAction")}
      </s-button>
      <s-button slot="secondary-actions" href="/admin/analytics">
        {t("dashboard.secondaryAction")}
      </s-button>

      <s-section>
        <s-stack gap="small-200">
          <s-heading>{t("dashboard.greeting", { shop: shopName })}</s-heading>
          <s-paragraph>{t("dashboard.intro")}</s-paragraph>
        </s-stack>
      </s-section>

      <s-section>
        <s-grid gap="base">
          <s-grid gap="small-200">
            <s-grid
              gridTemplateColumns="1fr auto"
              gap="small-300"
              alignItems="center"
            >
              <s-heading>{t("setupGuide.heading")}</s-heading>
              <s-button
                accessibilityLabel={t("setupGuide.toggleGuide")}
                variant="tertiary"
                tone="neutral"
                icon={expanded.guide ? "chevron-up" : "chevron-down"}
                onClick={() =>
                  setExpanded((current) => ({
                    ...current,
                    guide: !current.guide,
                  }))
                }
              ></s-button>
            </s-grid>
            <s-paragraph>{t("setupGuide.body")}</s-paragraph>
            <s-paragraph color="subdued">
              {t("setupGuide.progress")}
            </s-paragraph>
          </s-grid>
          <s-box
            borderRadius="base"
            border="base"
            background="base"
            display={expanded.guide ? "auto" : "none"}
          >
            <GuideStep
              title={t("setupGuide.steps.connect")}
              body={t("setupGuide.steps.connectBody")}
              action={t("setupGuide.steps.connectAction")}
              href="/admin/settings/general"
              image="/illustrations/onboarding.svg"
              alt={t("setupGuide.steps.connectAlt")}
              expanded={expanded.step1}
              onToggle={() =>
                setExpanded((current) => ({
                  ...current,
                  step1: !current.step1,
                }))
              }
              complete
              toggleLabel={t("setupGuide.toggleStep", { step: 1 })}
            />
            <s-divider></s-divider>
            <GuideStep
              title={t("setupGuide.steps.catalog")}
              body={t("setupGuide.steps.catalogBody")}
              action={t("setupGuide.steps.catalogAction")}
              href="/admin/products/new"
              image="/illustrations/catalog.svg"
              alt={t("setupGuide.steps.catalogAlt")}
              expanded={expanded.step2}
              onToggle={() =>
                setExpanded((current) => ({
                  ...current,
                  step2: !current.step2,
                }))
              }
              toggleLabel={t("setupGuide.toggleStep", { step: 2 })}
            />
            <s-divider></s-divider>
            <GuideStep
              title={t("setupGuide.steps.analytics")}
              body={t("setupGuide.steps.analyticsBody")}
              action={t("setupGuide.steps.analyticsAction")}
              href="/admin/analytics"
              image="/illustrations/analytics.svg"
              alt={t("setupGuide.steps.analyticsAlt")}
              expanded={expanded.step3}
              onToggle={() =>
                setExpanded((current) => ({
                  ...current,
                  step3: !current.step3,
                }))
              }
              toggleLabel={t("setupGuide.toggleStep", { step: 3 })}
            />
          </s-box>
        </s-grid>
      </s-section>

      <s-section
        heading={t("dashboard.performanceWithPeriod", {
          period: t("dashboard.period"),
        })}
        padding="base"
      >
        <s-grid
          gridTemplateColumns="@container (inline-size <= 400px) 1fr, 1fr auto 1fr auto 1fr"
          gap="small"
        >
          <MetricCard
            label={t("dashboard.sales")}
            value={formatMoney(locale, dashboardData.sales, "USD")}
            change={t("dashboard.salesChangeShort")}
            href="/admin/analytics"
          />
          <s-divider direction="block"></s-divider>
          <MetricCard
            label={t("dashboard.orders")}
            value={formatNumber(locale, dashboardData.orders)}
            change={t("dashboard.ordersChangeShort")}
            href="/admin/orders"
          />
          <s-divider direction="block"></s-divider>
          <MetricCard
            label={t("dashboard.conversion")}
            value={formatNumber(locale, dashboardData.conversion, {
              style: "percent",
              minimumFractionDigits: 1,
            })}
            change={t("dashboard.conversionChangeShort")}
            href="/admin/analytics"
          />
        </s-grid>
      </s-section>

      <s-section padding="none">
        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header listSlot="primary">
              {t("dashboard.channel")}
            </s-table-header>
            <s-table-header listSlot="labeled" format="currency">
              {t("dashboard.channelSales")}
            </s-table-header>
            <s-table-header listSlot="labeled" format="numeric">
              {t("dashboard.channelOrders")}
            </s-table-header>
          </s-table-header-row>
          <s-table-body>
            {channels.map((channel) => (
              <s-table-row key={channel.key}>
                <s-table-cell>{channel.label}</s-table-cell>
                <s-table-cell>
                  {formatMoney(locale, channel.sales, "USD")}
                </s-table-cell>
                <s-table-cell>
                  {formatNumber(locale, channel.orders)}
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading={t("dashboard.recentActivity")}>
        <s-stack gap="small-300">
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="package-fulfilled" tone="success"></s-icon>
            <s-text type="strong">{t("dashboard.activity.order")}</s-text>
            <s-text color="subdued">{t("dashboard.activity.orderBody")}</s-text>
          </s-stack>
          <s-divider></s-divider>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="person-add" tone="info"></s-icon>
            <s-text type="strong">{t("dashboard.activity.customer")}</s-text>
            <s-text color="subdued">
              {t("dashboard.activity.customerBody")}
            </s-text>
          </s-stack>
          <s-divider></s-divider>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-icon type="megaphone" tone="auto"></s-icon>
            <s-text type="strong">{t("dashboard.activity.promotion")}</s-text>
            <s-text color="subdued">
              {t("dashboard.activity.promotionBody")}
            </s-text>
          </s-stack>
        </s-stack>
      </s-section>

      <s-stack direction="inline" gap="base" alignItems="center">
        <s-text color="subdued">{t("dashboard.needHelp")}</s-text>
        <s-link href="/app/support">{t("dashboard.contactSupport")}</s-link>
      </s-stack>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
