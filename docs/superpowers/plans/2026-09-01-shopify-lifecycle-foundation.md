# Shopify Lifecycle Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable, Shopify-aligned lifecycle foundation that records webhook delivery, reconciles Managed Pricing history, projects current tenant state, and completely erases tenant data.

**Architecture:** Shopify webhook deliveries are a durable inbox and queue workload. Partner Historical Events are the canonical immutable business ledger; typed pure state machines project those events into relationship, subscription, and scope state. A Partner API reconciliation port repairs gaps and a tenant-purge port removes every tenant-owned record.

**Tech Stack:** React Router, TypeScript, Vitest, Cloudflare Workers/D1/KV/R2/Queues, Drizzle, Shopify App React Router, Shopify Partner GraphQL API.

**Spec:** `docs/superpowers/specs/2026-09-01-shopify-lifecycle-foundation-design.md`

## Global Constraints

- Start every production behavior with a focused failing test and observe RED before writing implementation.
- Only `app/models/*.server.ts` may query D1; services depend on ports and entry points only parse, dispatch, and respond.
- Every webhook uses `authenticate.webhook()`, `webhookId` idempotency, raw-body HMAC verification supplied by the SDK, and a static topic registry.
- Use integer minor-unit money plus currency; do not store raw Partner API money as a float.
- Partner API credentials are Cloudflare secrets, never merchant sessions or source-controlled values.
- Do not retain raw webhook payloads; store a SHA-256 hash and typed values only.
- Every tenant-owned table is deleted by the shop-redact workflow and tested for cross-shop isolation.
- Preserve existing unrelated bootstrap changes in README/package/scripts/config files.

---

### Task 1: Lifecycle domain state machines

**Files:**
- Create: `app/domain/shop-lifecycle.ts`
- Create: `app/domain/shop-lifecycle.test.ts`
- Create: `app/domain/subscription-lifecycle.ts`
- Create: `app/domain/subscription-lifecycle.test.ts`

**Interfaces:**
- Produces `applyRelationshipEvent(current, event)` and `isOperationalRelationship(state)`.
- Produces `applySubscriptionObservation(current, observation)` and `isPaidSubscription(state)`.

- [ ] Write failing tests for duplicate, stale, install, reinstall, uninstall, deactivate, reactivate, cancel-scheduled, frozen, canceled, and Active Subscription observations.
- [ ] Run the two domain test files and observe missing-export failures.
- [ ] Implement pure discriminated unions and transition maps with occurrence timestamp plus external ID ordering.
- [ ] Re-run the domain tests and observe green output.
- [ ] Commit the domain state machine slice.

### Task 2: Schema and repositories for transport, Shopify history, and projections

**Files:**
- Create: `app/db/schema/lifecycle.ts`
- Modify: `app/db/schema.ts`
- Create: `app/models/webhook-deliveries.server.ts`
- Create: `app/models/webhook-deliveries.test.ts`
- Create: `app/models/shopify-events.server.ts`
- Create: `app/models/shopify-events.test.ts`
- Modify: `app/db/schema/shops.ts`
- Modify: `app/models/shops.server.ts`
- Modify: `app/models/shops.test.ts`
- Generate: a new forward-only Drizzle SQL migration under `drizzle/`, named by
  `drizzle-kit generate` and never renamed afterward

**Interfaces:**
- `WebhookDeliveryRepo.claim(input): Promise<"claimed" | "duplicate">`
- `WebhookDeliveryRepo.markProcessing/markProcessed/markFailed`
- `ShopifyEventRepo.recordPartnerEvent(event): Promise<"inserted" | "duplicate">`
- `ShopRepo.applyRelationship(shop, transition): Promise<void>`

- [ ] Write failing repository tests using real D1 for delivery-ID uniqueness, event-ID uniqueness, typed relationship detail storage, projection ordering, and tenant isolation.
- [ ] Run those tests and observe RED due to missing schema/repositories.
- [ ] Add normalized lifecycle schema: delivery inbox, Partner event envelope, relationship/subscription details, current subscriptions/items, current scopes/history, and sync checkpoints.
- [ ] Generate the forward-only migration with `npm run db:generate`; inspect it for destructive changes before applying locally.
- [ ] Implement repositories and apply the pure transition results without importing models into domain code.
- [ ] Run repository tests plus all migration-sensitive tests; observe green output.
- [ ] Commit schema and repository slice.

### Task 3: Webhook inbox, queue, and uninstall/scope consumers

**Files:**
- Create: `app/services/webhook-ingest.ts`
- Create: `app/services/webhook-ingest.test.ts`
- Create: `app/services/webhook-consumer.ts`
- Create: `app/services/webhook-consumer.test.ts`
- Modify: `app/routes/webhooks/app/uninstalled.tsx`
- Modify: `app/routes/webhooks/app/uninstalled.test.ts`
- Modify: `app/routes/webhooks/app/scopes-update.tsx`
- Modify: `app/routes/webhooks/app/scopes-update.test.ts`
- Modify: `workers/app.ts`
- Modify: `wrangler.jsonc`
- Modify: `app/session-storage.server.ts`

**Interfaces:**
- Ingestion accepts authenticated `{ webhookId, eventId, topic, shop, apiVersion, triggeredAt, payload }` and returns duplicate/queued.
- Queue consumer receives a delivery ID, loads validated work, and dispatches through a static topic registry.

- [ ] Write failing tests for same delivery ID, same payload with different delivery ID, invalid HMAC, no-session uninstall cleanup, scopes diff persistence, and a consumer retry after failure.
- [ ] Run the affected tests and observe RED.
- [ ] Add the Queue/DLQ bindings in both local and production configuration and a Worker queue handler.
- [ ] Implement request ingestion, payload hashing, session deletion independent of SDK session, and a typed consumer registry.
- [ ] Run webhook and queue tests; verify Shopify endpoints return 200 only after a successful claim/enqueue.
- [ ] Commit webhook transport slice.

### Task 4: Partner API port, typed event parsing, and reconciliation

**Files:**
- Create: `app/ports/shopify-partner.ts`
- Create: `app/adapters/shopify-partner.server.ts`
- Create: `app/adapters/shopify-partner.test.ts`
- Create: `app/services/reconcile-shopify-history.ts`
- Create: `app/services/reconcile-shopify-history.test.ts`
- Create: `app/services/reconcile-subscription.ts`
- Create: `app/services/reconcile-subscription.test.ts`
- Modify: `app/services/scheduled.server.ts`
- Modify: `app/shopify.server.ts`
- Modify: `wrangler.jsonc`

**Interfaces:**
- Partner port lists cursor-paginated historical events and reads one shop's Active Subscription.
- Reconciler uses a watermark overlap, upserts events by Partner ID, and applies projections only through domain state machines.

- [ ] Write failing tests with a fake outer Partner HTTP boundary for pagination, overlap dedupe, late events, Partner failure visibility, relationship correction, subscription refresh, and no N+1 sync loop.
- [ ] Run those tests and observe RED.
- [ ] Search and validate the exact Partner GraphQL operations against the current supported Partner API version before adding the adapter.
- [ ] Implement the narrow port, adapter, pure parsers, checkpoints, scheduled sweep, and targeted refresh following authentication/billing return.
- [ ] Add required Partner credentials/app ID as Cloudflare secret/config names in local and production type generation inputs.
- [ ] Run reconciliation tests and the existing billing tests; observe green output.
- [ ] Commit Partner reconciliation slice.

### Task 5: Managed Pricing migration and internal projections

**Files:**
- Modify: `shopify.app.toml`
- Modify: `shopify.app.dev.toml`
- Modify: `app/routes/webhooks/app/subscriptions-update.tsx`
- Modify: `app/routes/webhooks/app/subscriptions-update.test.ts`
- Modify: `app/routes/app/billing.tsx`
- Modify: `app/routes/internal/dashboard.tsx`
- Modify: `app/routes/internal/shops/index.tsx`
- Modify: `app/routes/internal/shops/detail.tsx`
- Modify: `app/routes/internal/subscriptions.tsx`
- Modify: `app/routes/internal/support/index.tsx`
- Modify: `app/billing/dashboard-stats.ts`
- Modify: corresponding render/domain tests

**Interfaces:**
- Internal UI reads relationship and subscription projections only.
- A paid count requires an operational relationship and paid subscription state.

- [ ] Write failing tests showing an uninstalled paid shop is excluded from plan labels, support context, paid-shop totals, and MRR.
- [ ] Run those tests and observe RED.
- [ ] Remove legacy `app_subscriptions/update` configuration/route behavior and replace the old event page with canonical Partner event history.
- [ ] Update billing return handling to request an authoritative refresh rather than trust URL parameters.
- [ ] Run affected UI/domain tests and verify all documented relationship/subscription states render safely.
- [ ] Commit Managed Pricing projection slice.

### Task 6: Complete tenant purge and compliance workflow

**Files:**
- Create: `app/models/tenant-purge.server.ts`
- Create: `app/models/tenant-purge.test.ts`
- Modify: `app/services/compliance.server.ts`
- Modify: `app/services/compliance.test.ts`
- Modify: `app/services/compliance-support.test.ts`
- Modify: `app/routes/webhooks/compliance.tsx`
- Modify: `app/routes/webhooks/compliance.test.ts`
- Modify: `app/models/notification-logs.server.ts`
- Modify: `app/models/notification-settings.server.ts`
- Modify: `app/models/ai.server.ts`
- Modify: `app/session-storage.server.ts`

**Interfaces:**
- `TenantPurgeRepo.prepare(shop)` returns R2 keys and tenant-row count.
- `TenantPurgeRepo.deleteTenantRows(shop)` deletes all tenant tables atomically.

- [ ] Write failing tests that seed every tenant-owned table, sessions, and R2 attachment for two shops and prove redaction deletes only the requested tenant.
- [ ] Run the compliance/purge tests and observe RED.
- [ ] Implement the explicit cross-table purge repository, R2-first deletion, unconditional KV cleanup, and stale-work suppression.
- [ ] Mark customer compliance handlers as implemented no-customer-data behavior only after adding a data inventory guard test.
- [ ] Run the full compliance suite and observe green output.
- [ ] Commit privacy slice.

### Task 7: Base configuration and launch blockers

**Files:**
- Modify: `shopify.app.toml`
- Modify: `shopify.app.dev.toml`
- Modify: `wrangler.jsonc`
- Modify: `scripts/check-placeholders.mjs`
- Modify: `scripts/check-placeholders.test.mjs` or add equivalent contract test
- Modify: `app/legal/content.ts`
- Modify: `app/billing/plans.ts`
- Modify: `README.md`

**Interfaces:**
- `npm run check:placeholders` fails for fake legal identity/contact, app URL/client ID, redirect drift, plan handle, or production binding placeholder.

- [ ] Write failing checks for each disallowed launch placeholder and unused Admin scope.
- [ ] Run them and observe RED.
- [ ] Set empty required scopes, align auth redirect URLs to the real route pattern, document required business configuration, and extend launch checks.
- [ ] Do not fabricate legal entity names, contact addresses, production IDs, or plan handles; retain placeholders only where the launch check blocks deploy.
- [ ] Run launch checks with representative invalid and valid fixture configurations.
- [ ] Commit configuration slice.

### Task 8: Full verification, configuration validation, commit, and push

**Files:**
- Modify: plan checkboxes only if desired; no production behavior change.

- [ ] Run `npm run db:migrate:local`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:placeholders`, and `npm run build`.
- [ ] Run `shopify app config validate --json` for production and dev configurations when the linked account has access; record any account/configuration blocker honestly.
- [ ] Inspect `git diff --check`, `git status --short`, and all commits to ensure unrelated bootstrap changes remain untouched.
- [ ] Commit only lifecycle-foundation files in coherent commits.
- [ ] Push the branch with `git push` and report the resulting remote/commit IDs.
