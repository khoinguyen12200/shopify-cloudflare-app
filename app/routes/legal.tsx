import { Outlet } from "react-router";
import type { LinksFunction } from "react-router";
import styles from "./legal/legal.module.css";

/**
 * Public shell for the legal pages. NO authentication — the App Store listing
 * links straight to /legal/privacy, and a reviewer (or anyone) must be able to
 * open it without installing the app.
 *
 * These pages are deliberately plain HTML + CSS, not Polaris: Polaris web
 * components load App Bridge, which only makes sense embedded in the Shopify
 * admin. A public policy page is not embedded.
 */
export const links: LinksFunction = () => [];

export default function LegalLayout() {
  return (
    <div className={styles.page}>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
