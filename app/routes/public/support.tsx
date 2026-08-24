import type { MetaFunction } from "react-router";
import { APP_NAME, CONTACT_EMAIL } from "~/legal/content";

export const meta: MetaFunction = () => [{ title: `Support · ${APP_NAME}` }];

/**
 * Public support page. Not strictly mandatory, but the app requirements
 * checklist expects real support resources linked from the listing, and Polaris
 * asks for a help footer on every admin page pointing somewhere like this.
 * https://shopify.dev/docs/apps/launch/app-requirements-checklist
 *
 * Keep the emergency developer contact in your Partner Dashboard current too —
 * that is separate from this page.
 */
export default function Support() {
  return (
    <section className="section">
      <div className="prose stack">
        <h1>Support</h1>
        <p className="muted">Help with {APP_NAME}</p>

        <p className="notice notice--warning">
          <strong>Placeholder.</strong> Replace with real, Shopify-specific help
          content: setup steps, common problems, and how to reach you. Reviewers
          check that this is genuine documentation, not a marketing page.
        </p>

        <h2>Getting started</h2>
        <p>TODO: installation and first-run steps.</p>

        <h2>Common questions</h2>
        <p>TODO: the questions merchants actually ask.</p>

        <h2>Contact us</h2>
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. TODO:
          state your support hours and response target.
        </p>
      </div>
    </section>
  );
}
