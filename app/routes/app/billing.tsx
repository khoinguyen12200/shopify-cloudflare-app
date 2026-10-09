import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { authenticateAdmin } from "~/admin/require-merchant.server";
import { settle } from "~/admin/settle.server";
import type { Outcome } from "~/admin/outcome";
import { Deferred, FailedSection, PendingSection } from "~/components/admin/Deferred";
import { getEnv } from "~/request-context.server";
import { currentAppInstallationSchema } from "~/schemas/current-app-installation";
import { readAppHandle } from "./billing-app-handle.server";
import { ShopifyAppIdentityAdapter } from "~/adapters/shopify-app-identity.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDateTime } from "~/i18n/format";
import { useTimeZone } from "~/i18n/useTimeZone";
import { formatMoney } from "~/money";
import { resolveProjectionBillingStatus, type BillingStatus } from "~/billing/subscription-status";
import { currentPlanHandleFor } from "~/billing/current-plan";
import { planPriceLine, type PriceCadence } from "~/billing/plan-price-line";
import { pricingPlansUrl } from "~/billing/pricing-plans-url";
import { FEATURED_PLAN_HANDLE, PLANS, PLAN_LIST, planForShopifyHandle } from "~/billing/plans";
import {
  persistShopIdentity,
  planGrants,
  refreshShopHistory,
  refreshShopSubscription,
  shopSubscriptions,
} from "~/wiring.server";
import { PlanCard, PLAN_CARD_CSS } from "~/components/billing/PlanCard";
import type { SubscriptionStatus } from "~/billing/subscription-status";
import { isPricingReturn } from "~/billing/pricing-return";
import { reconcileShop } from "~/services/reconcile-shop";
import { resolveEffectivePlan } from "~/domain/plan-hierarchy";

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

type BillingReconciliationResponse = { readonly ok: true } | { readonly ok: false };

export function parseCurrentAppInstallationHandle(payload: unknown): string {
  const parsed = currentAppInstallationSchema.safeParse(payload);
  if (!parsed.success) {
    console.error(JSON.stringify({ event: "billing.current_app_installation.invalid_payload" }));
    throw new Response("Invalid current app installation response", { status: 502 });
  }
  return parsed.data.data.currentAppInstallation.app.handle;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticateAdmin(request);
  await persistShopIdentity(admin, session.shop);
  const result = await reconcileShop({
    refreshSubscription: () => refreshShopSubscription(getEnv(), session.shop),
    refreshHistory: () => refreshShopHistory(getEnv(), session.shop),
  });
  return result.status === "succeeded"
    ? data<BillingReconciliationResponse>({ ok: true })
    : data<BillingReconciliationResponse>({ ok: false }, { status: 502 });
};

/** The headline: which plan the shop is on. D1 only, so it is cheap, but it is still streamed with the rest. */
async function readPlan(shop: string) {
  // Shop identity is persisted once by the /app layout loader on the document load.
  // Shopify owns the actual subscribe/upgrade/cancel flow (Managed Pricing);
  // this page only ever reads status. There's no in-app request()/cancel() —
  // Partner history projects entitlement changes, and D1 serves normal visits.
  const now = Date.now();
  const [projection, activeGrant] = await Promise.all([
    shopSubscriptions().currentForShop(shop),
    planGrants().findActiveGrant(shop, now),
  ]);
  const effective = resolveEffectivePlan(
    projection?.planHandle,
    projection?.status,
    activeGrant,
    PLAN_LIST,
    now,
  );
  const planName = planForShopifyHandle(projection?.planHandle)?.name ?? PLANS.free.name;
  const status = resolveProjectionBillingStatus(projection, planName, now);

  const promo = effective.source === "promo" && effective.activePromo
    ? {
        handle: effective.planHandle,
        name: PLANS[effective.planHandle]?.name ?? effective.planHandle,
        remainingDays: effective.activePromo.remainingDays,
      }
    : null;

  return { status, planHandle: projection?.planHandle ?? null, promo };
}

type PlanLinkSource = {
  readonly shop: string;
  readonly env: ReturnType<typeof getEnv>;
  readonly graphql: (query: string) => Promise<Response>;
};

/** The hosted plan-selection URL. Needs the app handle (KV, else an Admin API call), so it is the slow part. */
async function readPlanLink({ shop, env, graphql }: PlanLinkSource): Promise<string | null> {
  const appHandle = await readAppHandle({
    kv: env.SESSION,
    shop,
    fetchHandle: async () => {
      const identity = await new ShopifyAppIdentityAdapter({
        graphql,
        expectedApiKey: env.SHOPIFY_API_KEY || null,
        expectedAppId: env.SHOPIFY_PARTNER_APP_ID || null,
      }).current();
      return identity.handle;
    },
  });
  return appHandle ? pricingPlansUrl(shop, appHandle) : null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authentication is awaited: Shopify requires a valid session token on every
  // request, and its redirect / bounce responses must keep working.
  const { admin, session } = await authenticateAdmin(request);
  if (shouldShowProcessing(request.url)) return { pricingReturn: true as const };

  const env = getEnv();
  const where = { shop: session.shop, route: "app/billing" };
  // Streamed, so the page frame renders now. The plan and the plan link fail
  // independently: with no link the page still shows the plan, minus the button.
  return {
    pricingReturn: false as const,
    plan: settle(readPlan(session.shop), { event: "admin.billing.plan.failed", ...where }),
    planLink: settle(
      readPlanLink({ shop: session.shop, env, graphql: (query) => admin.graphql(query) }),
      { event: "admin.billing.plan_link.failed", ...where },
    ),
  };
};

type Plan = Awaited<ReturnType<typeof readPlan>>;
type PlanLink = Promise<Outcome<string | null>>;

function PlanHeading({ status, promo }: Pick<Plan, "status" | "promo">) {
  const { t } = useTranslation(["admin", "common"]);
  return (
    <s-stack direction="inline" gap="small" alignItems="center">
      <s-heading>
        {promo ? promo.name : (status.kind === "free" ? PLANS.free.name : status.name)}
      </s-heading>
      {promo && (
        <s-badge tone="success">
          {t("billing.promoBadge", { days: promo.remainingDays })}
        </s-badge>
      )}
      {status.kind === "subscribed" && (
        <>
          <s-badge tone={STATUS_TONE[status.status]}>
            {t(`billing.status.${status.status}`)}
          </s-badge>
          {status.test && <s-badge tone="warning">{t("billing.testBadge")}</s-badge>}
        </>
      )}
    </s-stack>
  );
}

/**
 * The upgrade/manage button. Its URL is the slow part of the page, so while it
 * is pending the real button shows in its place, disabled and loading: the
 * column keeps its width and nothing reflows when the link arrives.
 */
function PlanAction({ status, planLink }: Pick<Plan, "status"> & { planLink: PlanLink }) {
  const { t } = useTranslation(["admin", "common"]);
  const label = status.kind === "free" ? t("billing.upgrade") : t("billing.manage");
  return (
    <Deferred
      resolve={planLink}
      pending={<s-button variant="primary" loading disabled>{label}</s-button>}
      failed={<s-text color="subdued">{t("billing.planLinkUnavailable")}</s-text>}
    >
      {(url) => (url ? <s-button variant="primary" href={url} target="_top">{label}</s-button> : null)}
    </Deferred>
  );
}

function PlanSummary({ status, promo, planLink }: Pick<Plan, "status" | "promo"> & { planLink: PlanLink }) {
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  const timeZone = useTimeZone();
  const cycleCopy =
    status.kind === "subscribed" ? billingCycleCopy(locale, timeZone, status) : null;
  const priceLine = planPriceLine(status);

  return (
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="start">
      <s-stack direction="block" gap="small-300">
        <s-text color="subdued">{t("billing.planLabel")}</s-text>
        <PlanHeading status={status} promo={promo} />

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

      <PlanAction status={status} planLink={planLink} />
    </s-grid>
  );
}

function PlanCatalog({ currentPlanHandle }: { currentPlanHandle: string | null }) {
  const { t } = useTranslation(["admin", "common"]);
  return (
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
            illustrationSrc={index === 0 ? "/plan-cards/lv1.svg" : index === 1 ? "/plan-cards/lv2.svg" : undefined}
            illustrationAlt={
              index === 0
                ? t("billing.plans.levelOneImageAlt")
                : index === 1
                  ? t("billing.plans.levelTwoImageAlt")
                  : undefined
            }
          />
        ))}
      </div>
    </s-section>
  );
}

export default function Billing() {
  const loaderData = useLoaderData<typeof loader>();
  const { t } = useTranslation(["admin", "common"]);
  if (loaderData.pricingReturn) return <BillingProcessing />;

  const { plan, planLink } = loaderData;

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
      <Deferred
        resolve={plan}
        pending={<PendingSection label={t("billing.loading")} />}
        failed={<FailedSection heading={t("billing.loadFailedHeading")} body={t("billing.loadFailedBody")} />}
      >
        {({ status, promo }) => (
          <s-section>
            <PlanSummary status={status} promo={promo} planLink={planLink} />

            {/* Says who owns the flow and what the button will do, so the merchant
                is not surprised by leaving the app to change plan. */}
            <s-paragraph color="subdued">{t("billing.managedNote")}</s-paragraph>
          </s-section>
        )}
      </Deferred>

      {/* The same promise as above: which card is "current" depends on the plan,
          while the catalog itself is static and keeps its heading while pending. */}
      <Deferred
        resolve={plan}
        pending={<PendingSection heading={t("billing.plans.heading")} label={t("billing.plansLoading")} />}
        failed={null}
      >
        {({ status, planHandle, promo }) => (
          <PlanCatalog currentPlanHandle={promo ? promo.handle : currentPlanHandleFor(status, planHandle)} />
        )}
      </Deferred>
    </s-page>
  );
}

function BillingProcessing() {
  const { t } = useTranslation(["admin", "common"]);
  const fetcher = useFetcher<BillingReconciliationResponse>();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data === undefined) {
      void fetcher.submit(null, { method: "post" });
    }
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.data?.ok) void navigate("/app/billing", { replace: true });
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
  timeZone: string,
  status: Subscribed,
): readonly [BillingCycleKey, { date: string; price?: string }] {
  const price = status.price ? formatMoney(locale, status.price) : undefined;

  if (status.trialEndsAt) {
    const date = formatDateTime(locale, status.trialEndsAt, timeZone);
    return price
      ? ["billing.current.trial", { date, price }]
      : ["billing.current.trialUnknownPrice", { date }];
  }

  const date = formatDateTime(locale, status.periodEnd, timeZone);
  return price
    ? ["billing.current.renews", { date, price }]
    : ["billing.current.renewsUnknownPrice", { date }];
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
