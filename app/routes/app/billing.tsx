import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDateTime } from "~/i18n/format";
import { formatMoney } from "~/money";
import { resolveProjectionBillingStatus, type BillingStatus } from "~/billing/subscription-status";
import { currentPlanHandleFor } from "~/billing/current-plan";
import { planPriceLine, type PriceCadence } from "~/billing/plan-price-line";
import { pricingPlansUrl } from "~/billing/pricing-plans-url";
import { FEATURED_PLAN_HANDLE, PLANS, PLAN_LIST, planForShopifyHandle } from "~/billing/plans";
import { persistShopIdentity, refreshShopHistory, refreshShopSubscription } from "~/wiring.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { PlanCard, PLAN_CARD_CSS } from "~/components/billing/PlanCard";
import type { SubscriptionStatus } from "~/billing/subscription-status";
import { isPricingReturn } from "~/billing/pricing-return";
import { reconcileShop } from "~/services/reconcile-shop";

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

/** Partner refreshes only after Shopify redirects from hosted plan selection. */
export function shouldRefreshSubscription(requestUrl: string): boolean {
  return isPricingReturn(requestUrl);
}

/** The return URL is a trigger only; the plan data still comes from Shopify. */
export function shouldShowProcessing(requestUrl: string): boolean {
  return isPricingReturn(requestUrl);
}

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

type BillingReconciliationResponse = { readonly ok: true } | { readonly ok: false };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await createShopify(getEnv()).authenticate.admin(request);
  await persistShopIdentity(admin, session.shop);
  const result = await reconcileShop({
    refreshSubscription: () => refreshShopSubscription(getEnv(), session.shop),
    refreshHistory: () => refreshShopHistory(getEnv(), session.shop),
  });
  return result.status === "succeeded"
    ? data<BillingReconciliationResponse>({ ok: true })
    : data<BillingReconciliationResponse>({ ok: false }, { status: 502 });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } =
    await createShopify(getEnv()).authenticate.admin(request);
  await persistShopIdentity(admin, session.shop);
  const pricingReturn = shouldShowProcessing(request.url);

  // Shopify owns the actual subscribe/upgrade/cancel flow (Managed Pricing);
  // this page only ever reads status. There's no in-app request()/cancel() —
  // Partner history projects entitlement changes, and D1 serves normal visits.
  const projection = await new ShopSubscriptionRepo().currentForShop(session.shop);
  const planName = planForShopifyHandle(projection?.planHandle)?.name ?? PLANS.free.name;
  const status = resolveProjectionBillingStatus(projection, planName, Date.now());

  const response = await admin.graphql(APP_HANDLE_QUERY);
  const body = await response.json();
  const appHandle: string = body.data?.currentAppInstallation?.app?.handle ?? "";

  return {
    status,
    planHandle: projection?.planHandle ?? null,
    pricingPlansUrl: pricingPlansUrl(session.shop, appHandle),
    pricingReturn,
  };
};

export default function Billing() {
  const loaderData = useLoaderData<typeof loader>();
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  if (loaderData.pricingReturn) return <BillingProcessing />;

  const { status, pricingPlansUrl, planHandle } = loaderData;
  const cycleCopy =
    status.kind === "subscribed" ? billingCycleCopy(locale, status) : null;
  const currentPlanHandle = currentPlanHandleFor(status, planHandle);
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
                {status.kind === "free" ? PLANS.free.name : status.name}
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
              key={plan.handle}
              plan={plan}
              // PLAN_LIST is cheapest-first, so the plan before this one is the
              // one it builds on — which is what "Everything in X, plus" names.
              buildsOn={index > 0 ? PLAN_LIST[index - 1] : null}
              isCurrent={plan.handle === currentPlanHandle}
              isFeatured={plan.handle === FEATURED_PLAN_HANDLE}
            />
          ))}
        </div>
      </s-section>
    </s-page>
  );
}

function BillingProcessing() {
  const { t } = useTranslation(["admin", "common"]);
  const fetcher = useFetcher<BillingReconciliationResponse>();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data === undefined) {
      fetcher.submit(null, { method: "post" });
    }
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.data?.ok) navigate("/app/billing", { replace: true });
  }, [fetcher.data, navigate]);

  const failed = fetcher.data?.ok === false;
  return (
    <s-page heading={t("billing.processing.heading")} inlineSize="base">
      <s-section>
        <s-stack direction="block" gap="large-100" alignItems="center">
          <s-spinner size="large-100" accessibilityLabel={t("billing.processing.spinnerLabel")} />
          <s-stack direction="block" gap="small" alignItems="center">
            <s-heading>{t("billing.processing.heading")}</s-heading>
            <s-paragraph color="subdued">{t("billing.processing.body")}</s-paragraph>
          </s-stack>
          {failed && (
            <s-banner tone="critical" heading={t("billing.processing.failedHeading")}>
              <s-paragraph>{t("billing.processing.failedBody")}</s-paragraph>
              <fetcher.Form method="post">
                <s-button slot="primary-actions" type="submit">{t("actions.retry", { ns: "common" })}</s-button>
              </fetcher.Form>
            </s-banner>
          )}
        </s-stack>
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
