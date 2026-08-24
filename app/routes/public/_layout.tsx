import { Link, Outlet } from "react-router";
import type { LinksFunction } from "react-router";
import { APP_NAME } from "~/legal/content";
// The public stylesheet is loaded HERE, by this layout's links(), so it ships
// only while a public route is matched. It must never reach the embedded admin,
// whose Polaris web components bring their own styling.
import publicStyles from "~/styles/public/public.scss?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: publicStyles },
];

const NAV = [
  { to: "/pricing", label: "Pricing" },
  { to: "/support", label: "Support" },
];

const FOOTER_LINKS = [
  { to: "/legal/privacy", label: "Privacy" },
  { to: "/legal/terms", label: "Terms" },
  { to: "/support", label: "Support" },
];

/**
 * Shell for every public page. Owns the stylesheet, header, footer and skip
 * link, so a page only writes its own content.
 */
export default function PublicLayout() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className="header">
        <div className="header__inner">
          <Link to="/" className="header__brand">
            {APP_NAME}
          </Link>
          <nav className="header__nav" aria-label="Main">
            <div className="header__nav-secondary">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </div>
            <Link to="/auth/login" className="btn btn--primary">
              Install
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
            © {new Date().getFullYear()} {APP_NAME}
          </span>
          <div className="footer__links">
            {FOOTER_LINKS.map((item) => (
              <Link key={item.to} to={item.to}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
