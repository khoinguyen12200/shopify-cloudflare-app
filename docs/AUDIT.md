# Template audit (second pass)

This review checks the starter against `AGENTS.md`, `.claude/rules/*`, the
current source tree, and the needs of an app that will be derived from it.
It distinguishes defects in the base from decisions that each adopting app
must make. The Shopify CLI in this environment does not provide `shopify doc
fetch`, so App Store statements are limited to evidence in this repository and
should be rechecked against Shopify's current requirements before submission.

## Executive assessment

The template has a strong foundation: tenant-aware D1 repositories, KV-backed
Shopify sessions, streamed R2 uploads, compliance webhook routing, integer
money, localized public/admin surfaces, and meaningful integration tests.

It is not yet a clean base for other apps. The highest-value work is to close
the composition-root leaks, make upload cleanup real, harden authentication and
security headers, and make external-input parsing and webhook lifecycle rules
explicit. The AI gate, legal copy, billing plans, and Shopify identifiers are
intentionally application-owned; they are not defects in a reusable starter,
but they must be impossible to overlook during adoption.

## Confirmed base defects

These are findings in the template itself, independent of the app's future
business model.

### B1. Unhandled SSR stream promise (high)

- **Where:** `app/entry.server.tsx:66`; type-aware promise linting is absent from `eslint.config.js`.
- **Why:** `stream.allReady.then(...)` can reject after the abort timeout. The rejection is not observed, violating the Workers no-floating-promises rule.
- **Plan:** attach a rejection handler while clearing the timer, and add the appropriate type-aware ESLint rules. Do not introduce an unavailable `ctx` parameter without verifying the React Router entry contract.
- **Acceptance:** an aborting render produces no unhandled rejection; lint fails a deliberately floating promise.

### B2. Composition root leaks (high)

- **Where:** adapter construction occurs in routes and services, including `app/routes/resources/support-upload.tsx`, `app/routes/app/support/new.tsx`, `app/routes/internal/dashboard.tsx`, `app/notifications/notify.server.ts`, and `app/notifications/eligibility/snapshot.server.ts`.
- **Why:** ring-5 and ring-3 code construct repositories directly, so adapters cannot be swapped or tested through ports consistently.
- **Plan:** expose surface-specific accessors from `app/wiring.server.ts` (split wiring internals if needed), then add a lint check preventing `new *Repo()` outside wiring and tests.
- **Acceptance:** production imports contain no repository construction outside the composition root; existing behavior and tests remain unchanged.

### B3. Orphan R2 uploads are not swept (high)

- **Where:** `app/routes/resources/support-upload.tsx:20-23` promises a daily sweep; `app/services/scheduled.server.ts` has no upload sweep.
- **Why:** abandoned `pending_uploads` rows and their R2 objects remain until tenant deletion, creating unbounded storage cost.
- **Plan:** add a scheduled port/repository operation that atomically identifies expired rows, returns keys, deletes the rows, and deletes those keys through the R2 adapter. Test both D1 and R2 effects. Until then, remove the promise from the comment.
- **Acceptance:** an expired row and object are both removed; a failed R2 delete is logged and retryable.

### B4. Authentication abuse controls are incomplete (high)

- **Where:** `app/routes/internal/login.tsx` and `app/routes/internal/forgot-password.tsx`; only `SUPPORT_LIMITER` exists in `wrangler.jsonc`.
- **Why:** expensive password verification and reset-email triggering have no per-client abuse control.
- **Plan:** define login/reset limiter bindings and a documented missing-binding policy. Key by a trusted client identity strategy, not blindly by a spoofable header; fail closed for production authentication if that is the chosen policy. Add route-level 429 tests.
- **Acceptance:** repeated attempts are throttled, legitimate deployments have configured bindings, and behavior when the binding is absent is explicit and tested.

### B5. Logout is GET-capable (medium)

- **Where:** `app/routes/internal/logout.tsx:11-12` exports a loader that destroys the session.
- **Why:** prefetchers or image/link requests can log a user out without an intentional form submission.
- **Plan:** make logout POST-only and return 405 for GET.
- **Acceptance:** the navigation form still signs out; a GET cannot mutate session state.

### B6. Sensitive compliance logs expose the shop domain (medium)

- **Where:** `app/services/compliance.server.ts:89,111,137`.
- **Why:** compliance logs contain plaintext tenant identifiers while webhook logs hash them.
- **Plan:** use one structured shop-hashing logger for compliance and webhook events; never log customer payloads, tokens, or secrets.
- **Acceptance:** tests or a log-shape check prove compliance events contain a hash, not the raw domain.

### B7. Attachment signing shares the Shopify API secret (medium)

- **Where:** `app/wiring.server.ts:162`.
- **Why:** compromise or rotation of one credential affects two unrelated trust domains.
- **Plan:** add an independently rotated `ATTACHMENT_TOKEN_SECRET` and document local/production provisioning. Treat existing tokens as invalidated during migration.
- **Acceptance:** attachment signing uses only the dedicated secret and missing configuration fails loudly.

### B8. Production config drift is easy (medium)

- **Where:** `wrangler.jsonc` top-level versus `env.production`.
- **Why:** named environments do not inherit most bindings or vars. `AI_GATEWAY_ID` is present locally but absent from production; the same class of drift can recur.
- **Plan:** add the variable where intentionally supported and make `check-placeholders.mjs` assert the production variable/binding contract. Keep optional values explicitly optional.
- **Acceptance:** a config test reports missing production keys before deployment; no placeholder resource id can deploy.

### B9. Webhook consumer lacks typed unknown-topic handling (medium)

- **Where:** `app/services/webhook-consumer.ts:23,49-60`.
- **Why:** `Record<string, ...>` makes adding a configured topic non-exhaustive, and unknown topics consume retries before DLQ.
- **Plan:** use a union-keyed registry and return/log an explicit unsupported outcome for unknown stored topics. Preserve retry behavior for actual handler failures.
- **Acceptance:** adding a topic without a handler fails typecheck; an old/unknown topic does not throw repeatedly.

### B10. Webhook delivery lifecycle is implicit (medium)

- **Where:** `app/models/webhook-deliveries.server.ts:26-131`.
- **Why:** legal transitions and lease behavior are encoded in SQL predicates rather than a pure state machine, making invalid transitions hard to reason about.
- **Plan:** introduce a pure lifecycle transition module and have the repository persist its decision. Keep lease duration as an injected policy value.
- **Acceptance:** every status/event pair has a tested result, including expired processing leases and illegal transitions.

### B11. Untrusted response/body casts remain (medium)

- **Where:** `app/routes/webhooks/compliance.tsx:27`, `app/components/support/AttachmentPicker.tsx:91`, and the GraphQL response read in `app/routes/app/billing.tsx:92-94`.
- **Why:** external data bypasses the repository's parse-at-the-edge rule and can fail later as malformed internal data.
- **Plan:** add focused Zod schemas at each boundary; return a structured 4xx or degraded result and log parse failures.
- **Acceptance:** malformed webhook, upload, and GraphQL payload tests prove no unchecked value reaches a use case.

### B12. Component owns network interaction (medium)

- **Where:** `app/components/support/AttachmentPicker.tsx:70`.
- **Why:** the component mixes presentation with upload orchestration, contrary to the component boundary rule.
- **Plan:** move the upload hook/controller beside the route and pass state/callbacks into the presentational component.
- **Acceptance:** the component has no `fetch` and remains render-testable with props.

### B13. Root stylesheet crosses surfaces (medium)

- **Where:** `app/root.tsx:33-43`.
- **Why:** a root-level stylesheet is loaded for public, embedded admin, and internal routes, risking style leakage into Polaris.
- **Plan:** load public SCSS only from the public layout and admin font assets only from the admin layout; verify with route render tests or a link inventory.
- **Acceptance:** each stylesheet is owned by exactly one surface layout.

### B14. Caught errors are not consistently observable (low)

- **Where:** `app/routes/resources/ai-draft.tsx:79-82`, `app/services/webhook-queue.ts:68-70`.
- **Why:** empty catches violate the structured-error rule and hide operational failures.
- **Plan:** log a stable event and return/rethrow an explicit reason at each catch.
- **Acceptance:** failure-path tests assert the returned failure and emitted event.

## Intentional template seams (not defects)

These were incorrectly classified as critical or launch blockers in the first
pass. They need adoption documentation and checks, not one universal policy.
The documentation gap is addressed by the [adoption checklist](ADOPTING_THE_TEMPLATE.md)
and [operations runbook](OPERATIONS.md); the app-specific decisions remain with
each adopter.

- **AI gating:** `app/wiring.server.ts:247-249` intentionally returns `allowAll`; `.claude/rules/cloudflare.md` defines this as the base default. Every app that exposes merchant-facing AI must replace it with plan/quota/kill-switch policy before production. Add an adoption check, but do not bake billing assumptions into the starter.
- **Compliance customer handlers:** the scaffold stores no customer records and already has tests documenting that outcome in `app/services/compliance.test.ts:121-175`. The real obligation is to update handlers whenever customer data is added; a filename grep is not a reliable control.
- **Legal copy, app identity, plans, URLs, scopes:** placeholders in `app/legal/content.ts`, locale files, `app/billing/plans.ts`, and Shopify config are expected in a template. They must block a release through an explicit adoption checklist, not be called defects in the base.
- **Dev client ID:** `shopify.app.dev.toml:3` is a public app client ID, not an API secret. Confirm it belongs to a disposable development app; do not describe it as a leaked secret.
- **Tenant foreign keys:** do not prescribe blanket `ON DELETE CASCADE`. Audit each table's retention and deletion semantics first, especially immutable/audit ledgers and derived webhook records.
- **Runtime purge coverage:** `assertTenantPurgeCoverage` is a deliberate production invariant. Optimize its query count only after measurement; moving it solely to tests weakens GDPR protection.
- **Server-side internal sessions:** signed cookie invalidation in KV may be worthwhile defense-in-depth, but it is an architectural expansion, not an automatic defect. Decide based on threat model and revocation requirements.
- **Deploy automation and dependency scanning:** valuable operational improvements, but organization-specific. The previous workflow proposal was not deployable (including a misspelled token name and an assumed `/healthz` route); design these only after choosing the Cloudflare/GitHub trust model.

## Documentation status

- **Resolved documentation gap:** [Operations runbook](OPERATIONS.md) documents
  deployment prerequisites, migration order, rollback boundaries, D1 recovery,
  cron and R2 investigation, secret rotation, and the supported DLQ workflow.
- **Resolved documentation gap:** [Adoption checklist](ADOPTING_THE_TEMPLATE.md)
  makes the app-owned identity, legal, translation, billing, AI, customer-data,
  production-resource, alerting, and App Store review gates explicit.
- **Accepted template seam:** deployment automation, alert thresholds, incident
  ownership, and CI/CD credentials remain organization-specific. The runbook
  states the required properties without pretending that one workflow fits all
  derived apps.

## Adoption checklist before an app ships

1. Replace legal, brand, billing, URL, scope, and locale placeholders; have counsel review privacy/terms.
2. Choose and test AI entitlement, quota, abuse, and emergency-disable policy if AI is enabled.
3. Provision production D1/KV/R2/email/rate-limit resources and every required secret; run placeholder/config checks.
4. Confirm all mandatory Shopify webhooks, HMAC behavior, data retention, and customer-data handlers for the app's actual schema.
5. Configure deployment approvals, rollback, DLQ operations, backups, alerting, and dependency update policy.
6. Run the current Shopify App Store checklist against the completed app and verify every public URL manually.

## Implementation plan

1. **Safety and cost:** B1, B3, B4, B5, B6, B7.
2. **Boundary integrity:** B2, B9, B10, B11, B12, B13, B14.
3. **Adoption tooling:** production-config parity checks, placeholder checks, release checklist, and an operations runbook.
4. **Verification:** for every behavior change, write and observe a failing test first; then run targeted tests and `npm run verify`. Do not claim a fix without fresh output.

## Verified strengths to preserve

- Integer minor-unit money with currency carried together.
- Shop-scoped repository queries and real local D1/KV/R2 integration tests.
- Timing-safe Shopify webhook authentication and idempotent inbox claiming.
- Streamed upload bodies rather than buffering large multipart requests.
- Tenant purge coverage assertion and explicit compliance routing.
- Localized public/admin rendering with route-scoped stylesheets as the target.
- Polaris-based embedded admin surfaces and explicit route tree.
