import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { i18nServer } from "~/i18n/i18n.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDate } from "~/i18n/format";
import {
  COMPANY_NAME,
  COMPANY_ADDRESS,
  CONTACT_EMAIL,
  LAST_UPDATED,
} from "~/legal/content";

export const handle = { i18n: ["common", "public"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = await i18nServer.getFixedT(request, "public");
  const common = await i18nServer.getFixedT(request, "common");
  return {
    title: `${t("legal.privacy.heading")} · ${common("appName")}`,
    appName: common("appName"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.title ?? "" },
];

/**
 * REQUIRED by the Shopify App Store: every listing must link to a public privacy
 * policy. https://shopify.dev/docs/apps/launch/privacy-requirements
 *
 * Put this URL in the "Privacy policy" field of your app submission.
 */
const SECTION_KEYS = [
  "collect",
  "why",
  "share",
  "storage",
  "security",
  "rights",
  "contactUs",
  "changes",
] as const;

export default function PrivacyPolicy() {
  const { t } = useTranslation("public");
  const { t: common } = useTranslation("common");
  const locale = useLocale();
  const appName = common("appName");

  // A date is formatted, never printed raw: 1/2/2026 means different days in
  // different locales.
  const updated = Number.isNaN(Date.parse(LAST_UPDATED))
    ? LAST_UPDATED
    : formatDate(locale, new Date(LAST_UPDATED), { dateStyle: "long" });

  return (
    <section className="section">
      <div className="prose stack">
        <h1>{t("legal.privacy.heading")}</h1>
        <p className="muted">{t("legal.lastUpdated", { date: updated })}</p>

        <p className="notice notice--warning">{t("legal.privacy.warning")}</p>

        <p>{t("legal.privacy.intro", { company: COMPANY_NAME, appName })}</p>

        {SECTION_KEYS.map((key) => (
          <section key={key}>
            <h2>{t(`legal.privacy.sections.${key}.heading`)}</h2>
            <p>{t(`legal.privacy.sections.${key}.body`)}</p>
          </section>
        ))}

        <div className="card stack">
          <p>
            <strong>{t("legal.privacy.contact")}</strong>
            <br />
            {COMPANY_NAME}
            <br />
            {COMPANY_ADDRESS}
            <br />
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
      </div>
    </section>
  );
}
