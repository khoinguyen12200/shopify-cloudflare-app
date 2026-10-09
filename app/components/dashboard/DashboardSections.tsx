import { useTranslation } from "react-i18next";

import { formatMoney, formatNumber } from "~/i18n/format";
import { useLocale } from "~/i18n/useLocale";
import { MetricCard } from "./MetricCard";

export type DashboardChannel = {
  readonly key: string;
  readonly label: string;
  readonly sales: number;
  readonly orders: number;
};

export type DashboardMetrics = {
  readonly sales: number;
  readonly orders: number;
  readonly conversion: number;
};

/** Each export renders an `s-section`, a direct child of `s-page` once rendered. */
export function PerformanceSection({ metrics }: { metrics: DashboardMetrics }) {
  const { t } = useTranslation("admin");
  const locale = useLocale();
  return (
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
          value={formatMoney(locale, metrics.sales, "USD")}
          change={t("dashboard.salesChangeShort")}
          href="/admin/analytics"
        />
        <s-divider direction="block"></s-divider>
        <MetricCard
          label={t("dashboard.orders")}
          value={formatNumber(locale, metrics.orders)}
          change={t("dashboard.ordersChangeShort")}
          href="/admin/orders"
        />
        <s-divider direction="block"></s-divider>
        <MetricCard
          label={t("dashboard.conversion")}
          value={formatNumber(locale, metrics.conversion, {
            style: "percent",
            minimumFractionDigits: 1,
          })}
          change={t("dashboard.conversionChangeShort")}
          href="/admin/analytics"
        />
      </s-grid>
    </s-section>
  );
}

export function ChannelsSection({ channels }: { channels: readonly DashboardChannel[] }) {
  const { t } = useTranslation("admin");
  const locale = useLocale();
  return (
    <s-section padding="none">
      <s-table variant="auto">
        <s-table-header-row>
          <s-table-header listSlot="primary">{t("dashboard.channel")}</s-table-header>
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
              <s-table-cell>{formatMoney(locale, channel.sales, "USD")}</s-table-cell>
              <s-table-cell>{formatNumber(locale, channel.orders)}</s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </s-section>
  );
}

export function RecentActivitySection() {
  const { t } = useTranslation("admin");
  return (
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
          <s-text color="subdued">{t("dashboard.activity.customerBody")}</s-text>
        </s-stack>
        <s-divider></s-divider>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type="megaphone" tone="auto"></s-icon>
          <s-text type="strong">{t("dashboard.activity.promotion")}</s-text>
          <s-text color="subdued">{t("dashboard.activity.promotionBody")}</s-text>
        </s-stack>
      </s-stack>
    </s-section>
  );
}
