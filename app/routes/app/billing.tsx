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
import { annualSavingPercent } from "~/billing/annual-savings";
import { pricingPlansUrl } from "~/billing/pricing-plans-url";
import { FEATURED_PLAN_KEY, PLANS, PLAN_LIST, type Plan } from "~/billing/plans";
import type { SubscriptionStatus } from "~/db/schema";

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

  // Shopify owns the actual subscribe/upgrade/cancel flow (Managed Pricing);
  // this page only ever reads status. There's no in-app request()/cancel() —
  // see app/routes/webhooks/app/subscriptions-update.tsx for how changes made
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

/**
 * The plan cards are the ONE hand-styled thing in this app's admin, by an
 * explicit decision: Polaris web components expose no font-size or weight
 * control (`s-text` takes only `color`/`type`/`tone`, and Shopify's own
 * metrics-card composition renders its big number as a plain `s-text`), so a
 * pricing card built strictly from them cannot give the price the weight a
 * pricing card needs. Everything else on this surface stays Polaris.
 *
 * The palette is declared in both schemes rather than hardcoded once: a single
 * fixed violet cannot clear 4.5:1 on a light surface AND stay legible on a
 * dark one, and the admin renders in both.
 */
const PLAN_CARD_CSS = `
.bp-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
  --bp-surface: #fff;
  --bp-border: #e1e1e1;
  --bp-muted: #616161;
  --bp-accent: #5c33cf;
  --bp-accent-tint: #f2ecfe;
  --bp-current-surface: #fbf9ff;
}
@media (min-width: 700px) {
  .bp-grid { grid-template-columns: 1fr 1fr; }
}
@media (prefers-color-scheme: dark) {
  .bp-grid {
    --bp-surface: #1c1c1c;
    --bp-border: #3d3d3d;
    --bp-muted: #a5a5a5;
    --bp-accent: #c3aeff;
    --bp-accent-tint: rgba(195,174,255,0.14);
    --bp-current-surface: rgba(195,174,255,0.06);
  }
}
.bp-card {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  border: 1px solid var(--bp-border);
  border-radius: 14px;
  background: var(--bp-surface);
}
.bp-card--current {
  border-color: var(--bp-accent);
  background: var(--bp-current-surface);
  box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -16px rgba(0,0,0,0.18);
}
.bp-pill {
  align-self: start;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: var(--bp-accent-tint);
  color: var(--bp-accent);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.bp-head { display: flex; flex-direction: column; gap: 0.375rem; }
.bp-name { font-size: 1rem; font-weight: 650; line-height: 1.2; }
.bp-price { display: flex; align-items: baseline; gap: 0.375rem; }
.bp-amount {
  font-size: 2.125rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.bp-cycle { font-size: 0.875rem; color: var(--bp-muted); }
.bp-annual { font-size: 0.8125rem; color: var(--bp-muted); line-height: 1.4; }
.bp-features {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding-block-start: 1.25rem;
  border-block-start: 1px solid var(--bp-border);
  list-style: none;
}
.bp-builds { font-size: 0.8125rem; font-weight: 600; }
.bp-feature {
  display: flex;
  align-items: start;
  gap: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.45;
}
.bp-check { flex: none; margin-block-start: 0.1875rem; color: var(--bp-accent); }
`;

/** The pill's tick and star, drawn rather than borrowed from an emoji. */
function PillIcon({ kind }: { kind: "check" | "star" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      {kind === "check" ? (
        <path
          d="M4 12.5l5 5 11-11.5"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 17.7l-5.9 3.2 1.2-6.6L2.5 9.6l6.6-.9z" fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * One plan, as a card. Reading order is the order a merchant decides in:
 * which plan → what it costs → how to get it → what it adds.
 *
 * The feature list is only ever what this plan adds over the one below it,
 * introduced by "Everything in X, plus" — so a four-plan ladder never makes
 * the merchant re-read the same six bullets four times.
 */
function PlanCard({
  plan,
  buildsOn,
  isCurrent,
  isFeatured,
}: {
  plan: Plan;
  buildsOn: Plan | null;
  isCurrent: boolean;
  isFeatured: boolean;
}) {
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();

  const isPaid = plan.priceMonthly.amount > 0;
  const savingPercent = annualSavingPercent(plan);

  return (
    <div className={isCurrent ? "bp-card bp-card--current" : "bp-card"}>
      {/* At most one pill per card, so they never stack or compete. The tinted
          fill and accent border already mark the current card ambiently; this
          names it. */}
      {isCurrent ? (
        <span className="bp-pill">
          <PillIcon kind="check" />
          {t("billing.currentPlanBadge")}
        </span>
      ) : (
        isFeatured && (
          <span className="bp-pill">
            <PillIcon kind="star" />
            {t("billing.plans.mostPopular")}
          </span>
        )
      )}

      <div className="bp-head">
        <div className="bp-name">{plan.name}</div>

        {/* The amount is the hero and carries the weight; the interval sits
            subdued on its baseline so the two read as one figure. */}
        <div className="bp-price">
          <span className="bp-amount">{formatMoney(locale, plan.priceMonthly)}</span>
          {isPaid && <span className="bp-cycle">{t("billing.plans.perMonth")}</span>}
        </div>

        {/* The annual line earns its place by saying what it saves, worked out
            from the two catalogue prices — never a written-down number that
            can drift from them. */}
        <div className="bp-annual">
          {!isPaid
            ? t("billing.plans.freeForever")
            : savingPercent !== null
              ? t("billing.plans.annualSaving", {
                  price: formatMoney(locale, plan.priceAnnual),
                  percent: savingPercent,
                })
              : t("billing.plans.annual", {
                  price: formatMoney(locale, plan.priceAnnual),
                })}
        </div>
      </div>

      {/* No per-card action: changing plan is one job with one owner, and that
          control lives once at the top of the page. */}
      <ul className="bp-features">
        {buildsOn && (
          <li className="bp-builds">
            {t("billing.plans.buildsOn", { plan: buildsOn.name })}
          </li>
        )}
        {plan.featureKeys.map((key) => (
          <li key={key} className="bp-feature">
            <span className="bp-check">
              <PillIcon kind="check" />
            </span>
            {t(`common:plans.${key}`)}
          </li>
        ))}
      </ul>
    </div>
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
