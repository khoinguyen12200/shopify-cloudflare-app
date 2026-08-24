/**
 * Content for the public legal pages.
 *
 * A **privacy policy is REQUIRED** for every Shopify App Store listing, and its
 * URL is a field in your app submission — the listing links to it, so it must be
 * publicly reachable without authentication.
 * https://shopify.dev/docs/apps/launch/privacy-requirements
 *
 * Terms of service and a support page are not strictly mandatory, but the app
 * requirements checklist expects real support resources, and every reviewer
 * looks for them. They are scaffolded here so the routes exist from day one.
 *
 * REPLACE EVERY PLACEHOLDER BELOW. Shipping this text as-is is worse than having
 * no policy: it is a false statement about how you handle personal data.
 * This is not legal advice — have a lawyer review the final wording.
 */

export const APP_NAME = "TODO: Your App Name";
export const COMPANY_NAME = "TODO: Your Legal Entity Name";
export const CONTACT_EMAIL = "TODO: privacy@example.com";
/** Some jurisdictions require a physical address in the privacy policy. */
export const COMPANY_ADDRESS = "TODO: Street, City, Region, Postcode, Country";
export const LAST_UPDATED = "TODO: YYYY-MM-DD";

/**
 * The questions Shopify says a privacy policy should answer. Keep the headings
 * and replace the bodies — a reviewer reads for these specifically.
 */
export const PRIVACY_SECTIONS = [
  {
    heading: "What personal data do we collect?",
    body: `TODO. List every category of personal data the app collects, from
      merchants and from their customers. Be exhaustive and specific — "usage
      data" is not a category. If the app collects none, say so plainly.`,
  },
  {
    heading: "Why do we collect it, and what do we do with it?",
    body: `TODO. State the purpose for each category above, and the legal basis
      if you rely on one. Say whether any of it is used to train models, build
      profiles, or make automated decisions.`,
  },
  {
    heading: "Who do we share it with?",
    body: `TODO. Name every third party and sub-processor that receives the data
      (hosting, analytics, email, support tooling, AI providers) and what each
      one does with it.`,
  },
  {
    heading: "Where is it stored, and for how long?",
    body: `TODO. Name the regions data is stored and processed in, and your
      retention period for each category. Cross-border transfers may need a
      specific safeguard — see Shopify's privacy requirements.`,
  },
  {
    heading: "How do we keep it secure?",
    body: `TODO. Describe encryption in transit and at rest, access controls, and
      how you handle a breach — including who you notify and how quickly.`,
  },
  {
    heading: "What rights do individuals have, and how are they exercised?",
    body: `TODO. Explain how someone requests access to, correction of, or
      deletion of their data, and how long you take. This app implements
      Shopify's mandatory compliance webhooks (customers/data_request,
      customers/redact, shop/redact), so requests made through a Shopify store
      reach us automatically.`,
  },
  {
    heading: "How do you contact us?",
    body: `TODO. A monitored address, and a physical address where a jurisdiction
      requires one. Say whether you have a Data Protection Officer.`,
  },
  {
    heading: "How will we tell you about changes?",
    body: `TODO. How this policy is versioned and how merchants are notified when
      it changes materially.`,
  },
] as const;

export const TERMS_SECTIONS = [
  {
    heading: "The agreement",
    body: `TODO. Who the agreement is between, and that installing the app
      accepts these terms.`,
  },
  {
    heading: "What the app does",
    body: `TODO. The service you are actually promising, in plain language.`,
  },
  {
    heading: "Fees and billing",
    body: `TODO. Charges, billing interval, trial terms, and what happens on
      upgrade, downgrade, and cancellation. Merchants must be able to change
      plans without contacting support.`,
  },
  {
    heading: "Acceptable use",
    body: `TODO. What a merchant may not do with the app.`,
  },
  {
    heading: "Availability and support",
    body: `TODO. Any uptime commitment, support hours, and response targets.`,
  },
  {
    heading: "Liability and warranties",
    body: `TODO. Have a lawyer write this section. Do not improvise it.`,
  },
  {
    heading: "Termination",
    body: `TODO. How either side ends the agreement, and what happens to stored
      data afterwards (this app purges shop data on the shop/redact webhook,
      which Shopify sends 48 hours after uninstall).`,
  },
  {
    heading: "Governing law",
    body: `TODO. Which jurisdiction governs, and where disputes are heard.`,
  },
] as const;
