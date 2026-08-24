import type { MetaFunction } from "react-router";
import {
  APP_NAME,
  COMPANY_NAME,
  COMPANY_ADDRESS,
  CONTACT_EMAIL,
  LAST_UPDATED,
  PRIVACY_SECTIONS,
} from "~/legal/content";
import styles from "./legal/legal.module.css";

export const meta: MetaFunction = () => [
  { title: `Privacy policy · ${APP_NAME}` },
  {
    name: "description",
    content: `How ${APP_NAME} collects, uses, and protects personal data.`,
  },
];

/**
 * REQUIRED by the Shopify App Store: every listing must link to a public privacy
 * policy. https://shopify.dev/docs/apps/launch/privacy-requirements
 *
 * Put this URL in the "Privacy policy" field of your app submission.
 */
export default function PrivacyPolicy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className={styles.updated}>Last updated: {LAST_UPDATED}</p>

      <p className={styles.todo}>
        <strong>This is a scaffold, not a policy.</strong> Every section below is
        a placeholder. Replace them before submitting to the App Store — shipping
        this text as-is is a false statement about how you handle personal data.
      </p>

      <p>
        This policy explains how {COMPANY_NAME} (&ldquo;we&rdquo;) handles
        personal data in connection with {APP_NAME}, an application for Shopify
        stores.
      </p>

      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
        </section>
      ))}

      <div className={styles.contact}>
        <p>
          <strong>Contact</strong>
          <br />
          {COMPANY_NAME}
          <br />
          {COMPANY_ADDRESS}
          <br />
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </>
  );
}
