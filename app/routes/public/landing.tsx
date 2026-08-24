import { Link, redirect } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { APP_NAME } from "~/legal/content";

export const meta: MetaFunction = () => [
  { title: `${APP_NAME} — a Shopify app` },
  { name: "description", content: `TODO: one-sentence description of ${APP_NAME}.` },
];

export const loader = ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // Shopify sends merchants here with ?shop=… when they open the app from the
  // admin. Hand them straight to the embedded app instead of the landing page.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }
  return null;
};

const FEATURES = [
  {
    title: "TODO: first capability",
    body: "TODO: what it does for the merchant, in their words, not yours.",
  },
  {
    title: "TODO: second capability",
    body: "TODO: the benefit, not the implementation.",
  },
  {
    title: "TODO: third capability",
    body: "TODO: keep these concrete — reviewers and merchants both skim.",
  },
];

export default function Landing() {
  return (
    <>
      <section className="section">
        <div className="container stack--lg center">
          <p className="eyebrow">TODO: category</p>
          <h1>TODO: what your app does, in one line</h1>
          <p className="lead">
            TODO: the follow-up sentence — who it is for and why it matters.
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            <Link to="/auth/login" className="btn btn--primary">
              Install on Shopify
            </Link>
            <Link to="/pricing" className="btn btn--secondary">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--subtle">
        <div className="container stack--lg">
          <h2 className="center">TODO: section heading</h2>
          <div className="grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="card stack">
                <h3>{f.title}</h3>
                <p className="muted">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
