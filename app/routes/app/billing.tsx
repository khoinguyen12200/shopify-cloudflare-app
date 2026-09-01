import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDateTime } from "~/i18n/format";
import { formatMoney } from "~/money";
import { resolveBillingStatus, type BillingStatus } from "~/billing/subscription-status";
import { currentPlanKeyFor } from "~/billing/current-plan";
import { planPriceLine, type PriceCadence } from "~/billing/plan-price-line";
import { pricingPlansUrl } from "~/billing/pricing-plans-url";
import { FEATURED_PLAN_KEY, PLANS, PLAN_LIST } from "~/billing/plans";
import { refreshShopSubscription } from "~/wiring.server";
import { PlanCard, PLAN_CARD_CSS } from "~/components/billing/PlanCard";
import type { SubscriptionStatus } from "~/billing/subscription-status";

type Subscribed = Extract<BillingStatus, { kind: "subscribed" }>;

/**
 * A literal map, not a template literal: `t()` is typed against the `en` files,
 * so a cadence with no message fails the build instead of rendering a raw key
 * to a merchant (@rules/i18n.md).
 */
type PriceKey =
  | "billing.price.perMonth"
  | "billing.price.perYear"
  | "billing.price.flat";

const PRICE_CADENCE_KEY: Record<PriceCadence, PriceKey> = {
  monthly: "billing.price.perMonth",
  yearly: "billing.price.perYear",
  none: "billing.price.flat",
};

export const handle = { i18n: ["common", "admin"] };

/** The app's own Managed Pricing handle — needed to build the hosted pricing URL. */
const APP_HANDLE_QUERY = `#graphql
  query AppHandle {
    currentAppInstallation {
      app {
        handle
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, billing, session } =
    await createShopify(getEnv()).authenticate.admin(request);
  await refreshShopSubscription(getEnv(), session.shop);

  // Shopify owns the actual subscribe/upgrade/cancel flow (Managed Pricing);
  // this page only ever reads status. There's no in-app request()/cancel() —
  // Partner subscription history projects entitlement changes.
  // on Shopify's hosted page reach this app.
  const check = await billing.check();
  const status = resolveBillingStatus(check, Date.now());

  const response = await admin.graphql(APP_HANDLE_QUERY);
  const body = await response.json();
  const appHandle: string = body.data?.currentAppInstallation?.app?.handle ?? "";

  return {
    status,
    pricingPlansUrl: pricingPlansUrl(session.shop, appHandle),
  };
};

export default function Billing() {
  const { status, pricingPlansUrl } = useLoaderData<typeof loader>();
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  const cycleCopy =
    status.kind === "subscribed" ? billingCycleCopy(locale, status) : null;
  const currentPlanKey = currentPlanKeyFor(status);
  const priceLine = planPriceLine(status);

  return (
    <s-page heading={t("billing.heading")}>
      {/*
        The shape is borrowed from the repair-ops console's plan card, because
        it answers the merchant's questions in the order they ask them: which
        plan am I on, what does it cost, how do I change it.

        A quiet label, the plan name as the one heavy thing on the card, the
        price under it, and the action on the opposite edge — top-aligned, so it
        sits against the plan name rather than drifting down beside the
        supporting lines. `s-grid` and not an inline `s-stack`: the left column
        must be free to grow and wrap without ever pushing the button onto its
        own row (@rules/polaris-app-home.md §4).

        Both branches keep this structure, so moving from free to paid changes
        the words on this page and never its layout.
      */}
      <s-section>
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="start">
          <s-stack direction="block" gap="small-300">
            <s-text color="subdued">{t("billing.planLabel")}</s-text>

            <s-stack direction="inline" gap="small" alignItems="center">
              <s-heading>
                {status.kind === "free" ? PLANS[currentPlanKey].name : status.name}
              </s-heading>
              {status.kind === "subscribed" && (
                <>
                  <s-badge tone={STATUS_TONE[status.status]}>
                    {t(`billing.status.${status.status}`)}
                  </s-badge>
                  {status.test && (
                    <s-badge tone="warning">{t("billing.testBadge")}</s-badge>
                  )}
                </>
              )}
            </s-stack>

            {/* Absent entirely when Shopify reported no amount — see
                ~/billing/plan-price-line for why a fallback would be a lie. */}
            {priceLine && (
              <s-text color="subdued">
                {t(PRICE_CADENCE_KEY[priceLine.cadence], {
                  price: formatMoney(locale, priceLine.price),
                })}
              </s-text>
            )}

            {/* The renewal or trial line is real information the price alone
                does not carry, so it survives the redesign. */}
            {cycleCopy && <s-text color="subdued">{t(...cycleCopy)}</s-text>}
          </s-stack>

          <s-button variant="primary" href={pricingPlansUrl} target="_top">
            {status.kind === "free" ? t("billing.upgrade") : t("billing.manage")}
          </s-button>
        </s-grid>

        {/* Says who owns the flow and what the button will do, so the merchant
            is not surprised by leaving the app to change plan. */}
        <s-paragraph color="subdued">{t("billing.managedNote")}</s-paragraph>
      </s-section>

      <s-section heading={t("billing.plans.heading")}>
        <s-paragraph color="subdued">{t("billing.plans.body")}</s-paragraph>
        <style dangerouslySetInnerHTML={{ __html: PLAN_CARD_CSS }} />
        <div className="bp-grid">
          {PLAN_LIST.map((plan, index) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              // PLAN_LIST is cheapest-first, so the plan before this one is the
              // one it builds on — which is what "Everything in X, plus" names.
              buildsOn={index > 0 ? PLAN_LIST[index - 1] : null}
              isCurrent={plan.key === currentPlanKey}
              isFeatured={plan.key === FEATURED_PLAN_KEY}
            />
          ))}
        </div>
      </s-section>
    </s-page>
  );
}

const STATUS_TONE: Record<SubscriptionStatus, "success" | "warning" | "critical" | "neutral"> = {
  ACTIVE: "success",
  ACCEPTED: "success",
  PENDING: "warning",
  FROZEN: "warning",
  CANCELLED: "critical",
  DECLINED: "critical",
  EXPIRED: "neutral",
};

type BillingCycleKey =
  | "billing.current.trial"
  | "billing.current.trialUnknownPrice"
  | "billing.current.renews"
  | "billing.current.renewsUnknownPrice";

/** Returns a [key, params] pair, spread straight into `t(...)` by the caller. */
function billingCycleCopy(
  locale: Parameters<typeof formatDateTime>[0],
  status: Subscribed,
): readonly [BillingCycleKey, { date: string; price?: string }] {
  const price = status.price ? formatMoney(locale, status.price) : undefined;

  if (status.trialEndsAt) {
    const date = formatDateTime(locale, status.trialEndsAt);
    return price
      ? ["billing.current.trial", { date, price }]
      : ["billing.current.trialUnknownPrice", { date }];
  }

  const date = formatDateTime(locale, status.periodEnd);
  return price
    ? ["billing.current.renews", { date, price }]
    : ["billing.current.renewsUnknownPrice", { date }];
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
