# Adopting this template

Use this checklist after creating a new repository from the template and before
deploying an app. It deliberately names decisions that no template can make
truthfully for another business. Complete each gate with an accountable owner
and evidence; a checked box is not a substitute for a tested implementation.

## 1. Establish app identity and Shopify configuration

- Create separate Shopify applications for development and production. Link
  `shopify.app.dev.toml` only to the development application and
  `shopify.app.toml` only to production.
- Set the production application URL and redirect URL, then confirm the
  production `SHOPIFY_APP_URL` and `SHOPIFY_API_KEY` agree with the production
  Shopify configuration.
- Choose only the Admin API scopes the app needs. Keep development and
  production scopes and webhook API versions aligned. Request protected
  customer-data access before adding topics that need it.
- Treat the Shopify client ID as public configuration. Keep the Shopify API
  secret out of source control and set it as a Cloudflare secret.

## 2. Replace product, legal, and translated copy

- Replace brand, feature, support, pricing, plan, identity, contact, and URL
  copy in every locale. Do not publish an untranslated fallback or text that
  describes a different product.
- Complete the privacy policy and terms with qualified legal review. Inventory
  every processor, data category, purpose, retention period, transfer, and
  contact route that the actual app uses.
- Ensure the public privacy, terms, pricing, and support pages are reachable at
  their final URLs and manually verify them in production.
- Run `npm run check:placeholders`; it is expected to block a fresh template and
  must pass before a production deploy.

## 3. Decide billing and AI policy

- Replace the billing-plan registry with actual plan names, prices, intervals,
  trial rules, and Managed Pricing handles. Verify the same handles in Shopify's
  Partner configuration before billing a merchant.
- If the app exposes AI, replace the template's allow-all gate with an explicit
  entitlement, quota, abuse, cost, privacy, and emergency-disable policy. Test
  normal, over-limit, provider-failure, and disabled states.
- If the app does not use AI, remove its UI and provider configuration rather
  than leaving a merchant-facing path with an undefined policy.

## 4. Inventory customer data and compliance behavior

- List every table, object, cache, log, queue payload, email, analytics event,
  and third-party processor that can contain merchant or customer data.
- For each new category of customer data, update the compliance handlers,
  deletion/retention policy, access process, and privacy copy. Test the real
  data path; webhook routing alone is not proof that data is deleted.
- Confirm Shopify mandatory compliance webhooks, HMAC verification, and
  idempotency behavior after adding or changing any data-bearing feature.
- Assign an owner for security incidents and data-subject requests, including a
  monitored contact channel and response expectations.

## 5. Provision production resources and secrets

- Create production D1, KV, R2, email, Queue/DLQ, and rate-limit resources;
  set their production binding details in `wrangler.jsonc`; then run
  `npm run cf-typegen`.
- Declare and provision every required secret: `SHOPIFY_API_SECRET`,
  `ATTACHMENT_TOKEN_SECRET`, `INTERNAL_SESSION_SECRET`, `SHOP_CUSTOM_DOMAIN`,
  and `SHOPIFY_PARTNER_API_TOKEN`. Secrets are never app configuration values.
- Configure `EMAIL_FROM` and `EMAIL_FROM_NAME` only after authorizing the
  sending domain. Test password recovery without exposing reset links in a
  production response.
- Confirm the production cron schedule, upload-cleanup monitoring, Webhook
  Queue/DLQ names, and login/reset rate-limit bindings are present.

## 6. Establish operations and release controls

- Assign owners and alert routes for Worker errors, cron sweep failures, queue
  backlog/DLQ growth, D1 recovery, secret rotation, and production access.
- Test a rollback and D1 recovery procedure in a non-production environment.
  A Worker rollback never reverses a data migration.
- Choose CI/CD identity, protected environments, review approvals, audit logs,
  artifact retention, and dependency-update policy. Automation is
  organization-specific; do not copy an unreviewed workflow from another app.
- Follow the incident and release procedures in [the operations runbook](OPERATIONS.md).

## 7. Perform the current App Store review

- Run the current Shopify App Store self-review against the completed app, not
  the template. Recheck Shopify requirements at submission time because they
  change.
- Verify installation, OAuth callback, billing, uninstall, mandatory webhooks,
  support, privacy, and terms end to end on a production-like environment.
- Review listing copy, screenshots, support contact, permissions, data use,
  merchant-facing error states, and accessibility with the final product.

## Release evidence

Attach the following to each production release: the commit SHA, reviewer and
approver, `npm run verify` output, production build output, placeholder-check
output, migration record, deployment version ID, and post-deploy smoke-test
results. This is the minimum evidence for a reproducible release, not a
replacement for your organization's change-management requirements.
