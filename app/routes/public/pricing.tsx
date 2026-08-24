import { Link } from "react-router";
import type { MetaFunction } from "react-router";
import { APP_NAME } from "~/legal/content";

export const meta: MetaFunction = () => [{ title: `Pricing — ${APP_NAME}` }];

/**
 * Public pricing page.
 *
 * Whatever you show here MUST match what the app actually charges. Shopify's app
 * requirements expect merchants to change plan without contacting support, and a
 * listing price that disagrees with the real charge is a review failure.
 * Consider Shopify Managed Pricing so the plan page is Shopify-hosted and always
 * consistent with billing.
 */
const PLANS = [
  {
    name: "TODO: Free / Starter",
    price: "$0",
    cadence: "forever",
    highlight: false,
    features: ["TODO: what is included", "TODO: the real limit", "TODO: support level"],
  },
  {
    name: "TODO: Growth",
    price: "$X",
    cadence: "per month",
    highlight: true,
    features: ["TODO: everything in Starter", "TODO: the differentiator", "TODO: support level"],
  },
  {
    name: "TODO: Plus",
    price: "$Y",
    cadence: "per month",
    highlight: false,
    features: ["TODO: everything in Growth", "TODO: the high-volume limit", "TODO: support level"],
  },
];

export default function Pricing() {
  return (
    <section className="section">
      <div className="container stack--lg">
        <div className="stack center">
          <h1>Pricing</h1>
          <p className="lead">TODO: one line on how pricing works.</p>
        </div>

        <p className="notice notice--warning">
          <strong>Placeholder.</strong> These plans must match what the app
          actually charges before you submit for review.
        </p>

        <div className="grid">
          {PLANS.map((plan) => (
            <article key={plan.name} className="card stack">
              <div className="row">
                <h3>{plan.name}</h3>
                {plan.highlight && <span className="badge">Popular</span>}
              </div>
              <p>
                <strong style={{ fontSize: "1.75rem" }}>{plan.price}</strong>{" "}
                <span className="muted">{plan.cadence}</span>
              </p>
              <ul role="list" className="stack">
                {plan.features.map((f) => (
                  <li key={f} className="muted">
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth/login"
                className={`btn ${plan.highlight ? "btn--primary" : "btn--secondary"}`}
              >
                Get started
              </Link>
            </article>
          ))}
        </div>

        <p className="muted center">
          Questions about a plan? <Link to="/support">Contact support</Link>.
        </p>
      </div>
    </section>
  );
}
