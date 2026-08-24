import { Link } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { i18nServer } from "~/i18n/i18n.server";

export const handle = { i18n: ["common", "public"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = await i18nServer.getFixedT(request, "public");
  const common = await i18nServer.getFixedT(request, "common");
  return { title: `${t("pricing.heading")} — ${common("appName")}` };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.title ?? "" },
];

/**
 * Whatever you show here MUST match what the app actually charges. Shopify's app
 * requirements expect merchants to change plan without contacting support, and a
 * listing price that disagrees with the real charge is a review failure.
 *
 * Prices live in the translation files, not here: currency symbol and decimal
 * separator differ per locale, and a Spanish merchant should see "1,50 €", not
 * "$1.50". For real amounts, use formatMoney() from ~/i18n/format so Intl does
 * it rather than a hand-built string.
 */
const PLAN_KEYS = ["starter", "growth", "plus"] as const;
const POPULAR: (typeof PLAN_KEYS)[number] = "growth";

export default function Pricing() {
  const { t } = useTranslation("public");

  return (
    <section className="section">
      <div className="container stack--lg">
        <div className="stack center">
          <h1>{t("pricing.heading")}</h1>
          <p className="lead">{t("pricing.lead")}</p>
        </div>

        <p className="notice notice--warning">{t("pricing.warning")}</p>

        <div className="grid">
          {PLAN_KEYS.map((key) => {
            const popular = key === POPULAR;
            return (
              <article key={key} className="card stack">
                <div className="row">
                  <h3>{t(`pricing.plans.${key}.name`)}</h3>
                  {popular && <span className="badge">{t("pricing.popular")}</span>}
                </div>
                <p>
                  <strong style={{ fontSize: "1.75rem" }}>
                    {t(`pricing.plans.${key}.price`)}
                  </strong>{" "}
                  <span className="muted">
                    {key === "starter" ? t("pricing.forever") : t("pricing.perMonth")}
                  </span>
                </p>
                <ul role="list" className="stack">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="muted">
                      {t("pricing.featureTodo")}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth/login"
                  className={`btn ${popular ? "btn--primary" : "btn--secondary"}`}
                >
                  {t("pricing.getStarted")}
                </Link>
              </article>
            );
          })}
        </div>

        <p className="muted center">
          {t("pricing.questions")}{" "}
          <Link to="/support">{t("pricing.contactSupport")}</Link>.
        </p>
      </div>
    </section>
  );
}
