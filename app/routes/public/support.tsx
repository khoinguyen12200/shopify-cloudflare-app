import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { i18nServer } from "~/i18n/i18n.server";
import { CONTACT_EMAIL } from "~/legal/content";

export const handle = { i18n: ["common", "public"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const t = await i18nServer.getFixedT(request, "public");
  const common = await i18nServer.getFixedT(request, "common");
  return {
    title: `${t("support.heading")} — ${common("appName")}`,
    appName: common("appName"),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data?.title ?? "" },
];

/**
 * Public support page. The app requirements checklist expects real support
 * resources linked from the listing, and Polaris asks for a help footer on every
 * admin page pointing somewhere like this.
 * https://shopify.dev/docs/apps/launch/app-requirements-checklist
 */
export default function Support() {
  const { t } = useTranslation("public");
  const { t: common } = useTranslation("common");
  const appName = common("appName");

  return (
    <section className="section">
      <div className="prose stack">
        <h1>{t("support.heading")}</h1>
        <p className="muted">{t("support.subheading", { appName })}</p>

        <p className="notice notice--warning">{t("support.warning")}</p>

        <h2>{t("support.gettingStarted")}</h2>
        <p>{t("support.gettingStartedBody")}</p>

        <h2>{t("support.faq")}</h2>
        <p>{t("support.faqBody")}</p>

        <h2>{t("support.contact")}</h2>
        <p>{t("support.contactBody", { email: CONTACT_EMAIL })}</p>
      </div>
    </section>
  );
}
