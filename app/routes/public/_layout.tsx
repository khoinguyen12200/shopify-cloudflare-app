import { Link, Outlet } from "react-router";
import type { LinksFunction } from "react-router";
import { useTranslation } from "react-i18next";
import { useLocale } from "~/i18n/useLocale";
import { LocaleSwitcher } from "~/i18n/LocaleSwitcher";
// The public stylesheet is loaded HERE, by this layout's links(), so it ships
// only while a public route is matched. It must never reach the embedded admin,
// whose Polaris web components bring their own styling.
import publicStyles from "~/styles/public/public.scss?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: publicStyles },
];

/** Namespaces this route tree needs — entry.server only ships these. */
export const handle = { i18n: ["common", "public"] };

export default function PublicLayout() {
  const { t } = useTranslation("common");
  const locale = useLocale();

  const appName = t("appName");

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t("a11y.skipToContent")}
      </a>

      <header className="header">
        <div className="header__inner">
          <Link to="/" className="header__brand">
            {appName}
          </Link>
          <nav className="header__nav" aria-label={t("nav.home")}>
            <div className="header__nav-secondary">
              <Link to="/pricing">{t("nav.pricing")}</Link>
              <Link to="/support">{t("nav.support")}</Link>
            </div>
            <LocaleSwitcher current={locale} />
            <Link to="/auth/login" className="btn btn--primary">
              {t("actions.install")}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="shell__main">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <span>
            {t("footer.copyright", {
              year: new Date().getFullYear(),
              appName,
            })}
          </span>
          <div className="footer__links">
            <Link to="/legal/privacy">{t("nav.privacy")}</Link>
            <Link to="/legal/terms">{t("nav.terms")}</Link>
            <Link to="/support">{t("nav.support")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
