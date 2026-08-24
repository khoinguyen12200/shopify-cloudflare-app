import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { i18nServer } from "~/i18n/i18n.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDate } from "~/i18n/format";
import { COMPANY_NAME, CONTACT_EMAIL, LAST_UPDATED } from "~/legal/content";

export const handle = { i18n: ["common", "public"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = await i18nServer.getFixedT(request, "public");
  const common = await i18nServer.getFixedT(request, "common");
  return {
    title: `${t("legal.terms.heading")} · ${common("appName")}`,
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.title ?? "" },
];

const SECTION_KEYS = [
  "agreement",
  "service",
  "fees",
  "acceptableUse",
  "availability",
  "liability",
  "termination",
  "law",
] as const;

export default function TermsOfService() {
  const { t } = useTranslation("public");
  const { t: common } = useTranslation("common");
  const locale = useLocale();

  const updated = Number.isNaN(Date.parse(LAST_UPDATED))
    ? LAST_UPDATED
    : formatDate(locale, new Date(LAST_UPDATED), { dateStyle: "long" });

  return (
    <section className="section">
      <div className="prose stack">
        <h1>{t("legal.terms.heading")}</h1>
        <p className="muted">{t("legal.lastUpdated", { date: updated })}</p>

        <p className="notice notice--warning">{t("legal.terms.warning")}</p>

        <p>
          {t("legal.terms.intro", {
            appName: common("appName"),
            company: COMPANY_NAME,
          })}
        </p>

        {SECTION_KEYS.map((key) => (
          <section key={key}>
            <h2>{t(`legal.terms.sections.${key}.heading`)}</h2>
            <p>{t(`legal.terms.sections.${key}.body`)}</p>
          </section>
        ))}

        <div className="card stack">
          <p>
            {t("legal.terms.questions")}{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </div>
    </section>
  );
}
