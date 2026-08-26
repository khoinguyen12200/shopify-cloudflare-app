import { useTranslation } from "react-i18next";

import { useLocale } from "~/i18n/useLocale";
import { formatMoney } from "~/money";
import { annualSavingPercent } from "~/billing/annual-savings";
import type { Plan } from "~/billing/plans";

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
export const PLAN_CARD_CSS = `
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
export function PlanCard({
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
