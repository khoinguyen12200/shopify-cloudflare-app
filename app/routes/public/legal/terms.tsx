import type { MetaFunction } from "react-router";
import {
  APP_NAME,
  COMPANY_NAME,
  CONTACT_EMAIL,
  LAST_UPDATED,
  TERMS_SECTIONS,
} from "~/legal/content";

export const meta: MetaFunction = () => [
  { title: `Terms of service · ${APP_NAME}` },
];

export default function TermsOfService() {
  return (
    <section className="section">
      <div className="prose stack">
      <h1>Terms of service</h1>
      <p className="muted">Last updated: {LAST_UPDATED}</p>

      <p className="notice notice--warning">
        <strong>Placeholder.</strong> Replace every section, and have a lawyer
        review the liability, warranty, and governing-law wording.
      </p>

      <p>
        These terms govern use of {APP_NAME}, provided by {COMPANY_NAME}.
      </p>

      {TERMS_SECTIONS.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <div className="card stack">
        <p>
          Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
      </div>
    </section>
  );
}
