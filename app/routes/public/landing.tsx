import { Link, redirect } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { i18nServer } from "~/i18n/i18n.server";
import { useLocale } from "~/i18n/useLocale";
import { formatMoney } from "~/money";
import { FEATURED_PLAN_HANDLE, PLANS } from "~/billing/plans";

export const handle = { i18n: ["common", "public"] };

/**
 * Titles and meta descriptions are rendered on the server before React runs, so
 * they cannot use the `useTranslation` hook — the loader translates them with
 * `getFixedT` and passes the result through.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Shopify sends merchants here with ?shop=… when they open the app from the
  // admin. Hand them straight to the embedded app instead of the landing page.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  const t = await i18nServer.getFixedT(request, "public");
  const common = await i18nServer.getFixedT(request, "common");
  return {
    title: `${common("appName")} — ${t("landing.heading")}`,
    description: t("landing.lead"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.title ?? "" },
  { name: "description", content: data?.description ?? "" },
];

const FEATURE_KEYS = ["one", "two", "three"] as const;

export default function Landing() {
  const { t } = useTranslation("public");
  const locale = useLocale();

  return (
    <>
      <section className="section">
        <div className="container stack--lg center">
          <p className="eyebrow">{t("landing.eyebrow")}</p>
          <h1>{t("landing.heading")}</h1>
          <p className="lead">{t("landing.lead")}</p>
          <div className="row row--center">
            <Link to="/auth/login" className="btn btn--primary">
              {t("landing.installCta")}
            </Link>
            <Link to="/pricing" className="btn btn--secondary">
              {t("landing.pricingCta")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--subtle">
        <div className="container stack--lg">
          <h2 className="center">{t("landing.featuresHeading")}</h2>
          <div className="grid">
            {FEATURE_KEYS.map((key) => (
              <article key={key} className="card stack">
                <h3>{t(`landing.features.${key}.title`)}</h3>
                <p className="muted">{t(`landing.features.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container stack--lg center">
          <h2>{t("landing.pricingTeaser.heading")}</h2>
          <p className="lead">
            {t("landing.pricingTeaser.body", {
              price: formatMoney(locale, PLANS[FEATURED_PLAN_HANDLE].priceMonthly),
            })}
          </p>
          <Link to="/pricing" className="btn btn--secondary">
            {t("landing.pricingTeaser.cta")}
          </Link>
        </div>
      </section>
    </>
  );
}
