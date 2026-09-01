# Shopify Lifecycle Foundation Completion Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the reusable Shopify public-app foundation so relationship state, Managed Pricing state, webhook delivery, reconciliation, tenant erasure, internal views, launch configuration, and agent bootstrap have one tested source of truth.

**Architecture:** Partner Historical Events is immutable business truth. Webhook inbox rows are transport observations only. `shops`, `shop_subscriptions`, scopes, and operational health are projections updated through ports and ordered state machines. D1 access stays in models; services remain framework-free and depend on ports.

**Tech Stack:** React Router, TypeScript, Vitest, Drizzle D1, Cloudflare Workers, Queues, KV, R2, Shopify Partner API `2026-07`.

**Spec:** `docs/superpowers/specs/2026-09-01-shopify-lifecycle-foundation-design.md`

## Global Constraints

- Run RED before every production behavior change, then GREEN, then refactor.
- Never persist raw Shopify webhook or Partner payload JSON.
- Only `app/models/*.server.ts` imports Drizzle or calls `getDb()`.
- Services import ports and pure domain code; services never import models or adapters.
- Every event consumer is idempotent; every projection is tenant-scoped and ordered by `(occurredAt, externalId)`.
- Money stays integer minor units plus currency; Shopify decimal strings enter through `~/money`.
- Do not add Shopify fields, enum values, scopes, webhook topics, or Polaris props from memory; search and validate against Shopify docs first.
- Preserve `TODO:` legal/business identity values, but production checks must fail until they are replaced.
- Keep files below 700 lines and functions below 60 lines.

## Current Baseline

Already complete and pushed through `deeb64b`:

- Lifecycle state machines and normalized lifecycle schema.
- Webhook inbox, durable claims, Queue/DLQ wiring, uninstall and scope-update routes.
- Removal of `app_subscriptions/update` route/configuration.
- Exclusion of uninstalled shops from billing totals.
- Typed Partner relationship/subscription event parser and cursor-paginated history adapter.
- Codex/Claude skill bootstrap, Shopify MCP config, legal template, and setup tests.

Remaining work below starts from that baseline. Do not recreate completed behavior.

---

### Phase 1: Finish Partner Adapter Contracts

**Files:**
- Modify: `app/ports/shopify-partner.ts`
- Modify: `app/adapters/shopify-partner.server.ts`
- Modify: `app/adapters/shopify-partner-events.ts`
- Modify: `app/adapters/shopify-partner.test.ts`
- Modify: `app/adapters/shopify-partner-events.test.ts`

**Produces:** typed `PartnerHistoryEvent`, typed `ActiveSubscription`, and a Partner port with no `unknown` return values.

**Interfaces:**

```ts
export interface ShopifyPartnerPort {
  listHistoricalEvents(input: {
    readonly appId: string;
    readonly shopId?: string;
    readonly cursor?: string | null;
    readonly occurredAtMin?: string;
  }): Promise<{
    readonly events: readonly PartnerHistoryEvent[];
    readonly hasNextPage: boolean;
    readonly endCursor: string | null;
  }>;
  activeSubscription(appId: string, shopId: string): Promise<ActiveSubscription | null>;
}
```

- [ ] Search Partner docs for every `ActiveSubscription` field used: `billingPeriod`, `cancelAtEndOfCycle`, `trialEndsAt`, `currentBillingCycle`, `items`, `price` fragments, `discount`, `usage`, `pendingUpdate`, and `legacySubscriptionId`.
- [ ] Validate the final `HistoricalEvents` query and final `ActiveSubscription` query with `.agents/skills/shopify-partner/scripts/validate.mjs --version 2026-07`; keep stable artifact IDs and increment revisions on retries.
- [ ] Add RED tests for HTTP failure, GraphQL errors, missing `data`, missing pagination, cursor/overlap variables, all six subscription event states, invalid date/shop/id, flat-rate money, tiered pricing, null active subscription, and pending update.
- [ ] Run focused tests and confirm failures are missing type/parser behavior, not malformed fixtures.
- [ ] Implement manual narrowing at the HTTP boundary. Convert Shopify amount strings with `parseMoney`; reject malformed amounts and currencies. Return only normalized fields; discard unknown fields.
- [ ] Map Partner subscription states to domain states: `CREATED -> PENDING`, `UPDATED -> ACTIVE`, `CANCELLATION_SCHEDULED -> CANCELLATION_SCHEDULED`, `CANCELED -> CANCELED`, `FROZEN -> FROZEN`, `UNFROZEN -> ACTIVE`.
- [ ] Run focused tests, typecheck, and lint. Commit `feat: complete typed Partner contracts`.

---

### Phase 2: Build Immutable Ledger and Current Projections

**Files:**
- Modify: `app/models/shopify-events.server.ts`
- Modify: `app/models/shops.server.ts`
- Modify: `app/db/schema/lifecycle.ts`
- Create: `app/models/shop-subscriptions.server.ts`
- Create: `app/models/shop-sync-checkpoints.server.ts`
- Modify: `app/models/shopify-events.test.ts`
- Modify: `app/models/shops.test.ts`
- Create: `app/models/shop-subscriptions.test.ts`
- Create: `app/models/shop-sync-checkpoints.test.ts`

**Produces:** atomic event recording plus ordered relationship/subscription projections and checkpoint persistence.

**Interfaces:**

```ts
recordPartnerRelationship(event: PartnerRelationshipEvent): Promise<"inserted" | "duplicate">;
recordPartnerSubscription(event: PartnerSubscriptionEvent): Promise<"inserted" | "duplicate">;
upsertRelationshipProjection(event: RelationshipObservation): Promise<"applied" | "stale" | "duplicate">;
upsertSubscriptionProjection(event: SubscriptionObservation): Promise<"applied" | "stale" | "duplicate">;
readCheckpoint(name: string): Promise<SyncCheckpoint | null>;
markCheckpointSucceeded(name: string, cursor: string | null, watermarkAt: number, now: number): Promise<void>;
markCheckpointFailed(name: string, code: string, detail: string, now: number): Promise<void>;
```

- [ ] Add RED D1 tests proving duplicate Partner IDs do not alter projections; older `(occurredAt, externalId)` events cannot regress state; same event ID from separate sources remains distinct; shop A cannot read or mutate shop B.
- [ ] Add RED tests proving subscription item rows are replaced atomically, prices retain minor units/currency, and a null active subscription projects `NONE` without deleting historical rows.
- [ ] Add RED tests proving checkpoint cursor/watermark advances only after successful full sync and failed sync stores bounded error metadata.
- [ ] Run focused tests and observe expected missing methods.
- [ ] Implement `record*` as one D1 transaction: insert common ledger row first, inspect insert result, insert typed child only when new, then apply projection only when insert won.
- [ ] Implement projection ordering using domain transition functions and a persisted applied timestamp plus external ID tie-breaker.
- [ ] Add indexes needed for shop-first reads and latest-current queries. Generate a forward migration; inspect SQL manually for additive changes and safe legacy compatibility.
- [ ] Run `npm run db:migrate:local`, focused model tests, typecheck, lint. Commit `feat: project Partner lifecycle events`.

---

### Phase 3: Reconcile Partner History and Active Subscription

**Files:**
- Create: `app/services/reconcile-shopify-history.ts`
- Create: `app/services/reconcile-shopify-history.test.ts`
- Create: `app/services/reconcile-subscription.ts`
- Create: `app/services/reconcile-subscription.test.ts`
- Modify: `app/services/scheduled.server.ts`
- Modify: `app/shopify.server.ts`
- Modify: `app/wiring.server.ts`
- Modify: `workers/app.ts`
- Modify: `app/routes/auth/callback.tsx`
- Modify: billing return route identified by `rg -n "billing|returnUrl|redirect" app/routes`

**Produces:** daily overlap sync, per-shop subscription refresh, observable failures, and safe wiring.

**Interfaces:**

```ts
reconcileHistory(deps: {
  readonly partner: ShopifyPartnerPort;
  readonly checkpoint: SyncCheckpointPort;
  readonly ledger: LifecycleLedgerPort;
  readonly clock: Clock;
  readonly appId: string | null;
}, now: number): Promise<ReconcileResult>;

refreshSubscription(deps: {
  readonly partner: ShopifyPartnerPort;
  readonly subscriptions: SubscriptionProjectionPort;
  readonly clock: Clock;
  readonly appId: string | null;
}, shop: ShopIdentity, now: number): Promise<RefreshResult>;
```

- [ ] Add RED pure-service tests for 250-item pages, cursor progression, fixed overlap window, duplicate IDs across overlap, event ordering, checkpoint success after final page only, checkpoint failure on any page error, missing app ID/token, and bounded error details.
- [ ] Add RED tests asserting exactly one Active Subscription request per target shop, null response becoming `NONE`, and stale current state being replaced by authoritative response.
- [ ] Run service tests and verify failures arise from absent orchestration.
- [ ] Implement history loop with a fixed clock-derived overlap, page until `hasNextPage` is false, send each typed event to ledger, and mark checkpoint only after all pages commit.
- [ ] Implement targeted refresh after successful OAuth callback, authenticated embedded access, and billing return. Validate shop context from authenticated session; never trust redirect query parameters as entitlement.
- [ ] Add one guarded scheduled sweep with a bounded shop batch and `waitUntil` only for short dispatch; enqueue long reconciliation work.
- [ ] Wire missing Partner credentials to `markCheckpointFailed`; never infer free/none from unavailable Partner data.
- [ ] Run service, scheduled, auth, and billing tests; typecheck; lint. Commit `feat: reconcile Shopify pricing history`.

---

### Phase 4: Remove Legacy Billing Source Completely

**Files:**
- Create: forward migration dropping legacy table after migration/backfill
- Delete: `app/models/subscription-events.server.ts`
- Delete: `app/models/subscription-events.test.ts`
- Delete: `app/billing/subscription-event.ts`
- Delete: `app/billing/subscription-event.test.ts`
- Modify: `app/db/schema/billing.ts`
- Modify: `app/db/schema.ts`
- Modify: `app/billing/dashboard-stats.ts`
- Modify: `app/billing/dashboard-stats.test.ts`
- Modify: internal dashboard/shop/subscription/support routes and tests found by search
- Modify: `app/billing/plans.ts`
- Modify: `app/schemas/webhooks.ts`

- [ ] Add RED data/render tests for installed paid, scheduled cancellation paid, frozen free, deactivated free, and uninstalled free; assert dashboard MRR, subscription list, shop detail, and support labels use same projection.
- [ ] Run affected tests and record old repository imports as expected RED.
- [ ] Add a one-time forward migration that copies only safely parseable legacy rows into normalized ledger/subscription history with source `legacy_migration`; reject/log malformed rows without fabricating values.
- [ ] Change all readers to projection queries. Dashboard stats reads current installed relationships joined to current subscriptions; subscription activity reads normalized ledger; support uses current projection.
- [ ] Remove legacy parser, model, schema export, route copy, and tests. Keep migration SQL history only; no runtime symbol remains.
- [ ] Run `rg -n "subscription_events|SubscriptionEventRepo|app_subscriptions/update|storedEventPrice|SubscriptionEventInput" app` and require zero results.
- [ ] Run local migrations, affected tests, full typecheck/lint. Commit `refactor: remove legacy billing truth`.

---

### Phase 5: Complete Webhook Scope and Delivery Hardening

**Files:**
- Modify: `app/routes/webhooks/app/scopes-update.tsx`
- Modify: `app/services/webhook-consumers.server.ts` or current consumer location
- Modify: `app/models/webhook-deliveries.server.ts`
- Modify: `app/models/shops.server.ts`
- Modify: `app/models/shop-scopes.server.ts`
- Modify: `workers/app.ts`
- Create/modify focused webhook and queue tests beside each subject

- [ ] Add RED test that scope-update consumer updates `shop_granted_scopes`, appends one scope diff with granted/revoked rows, and replay produces no second diff.
- [ ] Add RED test that a dead-letter transition updates inbox status to `dead_letter` with bounded failure code/detail.
- [ ] Add RED test that redacted shop causes queued work to acknowledge without projection writes.
- [ ] Implement consumer flow: claim delivery, check redaction marker, apply normalized scope set/diff transaction, mark processed; retry transient failure; mark dead letter after configured attempt ceiling.
- [ ] Ensure uninstall deletes all KV sessions independently of optional SDK session and marks relationship uninstalled before queue handoff.
- [ ] Add structured logs containing delivery ID, topic, hashed shop, outcome, attempts, and latency; never log payload/token.
- [ ] Run webhook/queue tests, typecheck, lint. Commit `feat: harden webhook projections and DLQ`.

---

### Phase 6: Dedicated Tenant Erasure

**Files:**
- Create: `app/models/tenant-purge.server.ts`
- Create: `app/models/tenant-purge.test.ts`
- Modify: `app/services/compliance.server.ts`
- Modify: compliance tests
- Modify: `app/session-storage.server.ts`
- Modify: support attachment adapter/model
- Modify: `workers/app.ts`
- Create: schema inventory test/helper

**Produces:** one durable purge workflow covering D1, KV, R2, and stale queues.

**Interfaces:**

```ts
prepareTenantPurge(shop: string): Promise<{ readonly shop: string; readonly attachmentKeys: readonly string[] }>;
deleteTenantRows(shop: string): Promise<void>;
purgeTenant(deps: { readonly d1: TenantPurgePort; readonly kv: SessionPurgePort; readonly r2: AttachmentPurgePort; readonly clock: Clock }, shop: string): Promise<PurgeResult>;
```

- [ ] Add RED two-tenant integration fixture that discovers every D1 table containing a `shop` column and seeds support, messages, attachments, notifications, opt-outs, AI runs, lifecycle rows, scopes, deliveries, subscription rows, checkpoints, and migration rows.
- [ ] Add RED KV/R2 isolation tests: target shop sessions and attachment keys disappear; other shop data remains.
- [ ] Add RED stale-queue test: redacted shop work is acknowledged with zero writes.
- [ ] Implement R2 key listing/deletion first, then one D1 transaction deleting all tenant rows, then unconditional KV session deletion. Keep anonymized compliance receipt only if required and without domain, payload, customer data, or token.
- [ ] Move cross-table deletion out of `ShopRepo`; leave `ShopRepo` responsible only for shop projection operations.
- [ ] Make `customers/data_request` and `customers/redact` explicit `implemented: true`, `no_customer_data: true` outcomes only after inventory test proves no customer identifiers exist.
- [ ] Add schema inventory guard that fails when new `shop` table is not included in purge fixture/list.
- [ ] Run compliance, purge, queue, full tests; typecheck; lint. Commit `feat: complete tenant erasure workflow`.

---

### Phase 7: Internal Views and Operational Health

**Files:**
- Create: projection read models under `app/models/`
- Modify: `app/routes/internal/dashboard.tsx`
- Modify: `app/routes/internal/shops/index.tsx`
- Modify: `app/routes/internal/shops/detail.tsx`
- Modify: `app/routes/internal/subscriptions.tsx`
- Modify: `app/routes/internal/support/index.tsx`
- Modify: `app/routes/internal/support/detail.tsx`
- Add/update colocated render/data tests

- [ ] Add RED tests asserting all internal views agree on relationship state, subscription state, cancellation date, paid status, and MRR.
- [ ] Implement one-query shop-scoped projection reads; never reconstruct current status from raw event rows in route code.
- [ ] Display reconciliation checkpoint health, last success/failure, webhook failure/DLQ counts, and lifecycle/subscription history using translated labels and `app/i18n/format.ts`.
- [ ] Remove stale copy mentioning `app_subscriptions/update`.
- [ ] Run render/data tests and accessibility checks. Commit `feat: expose lifecycle operations health`.

---

### Phase 8: Launch Contract and Agent Bootstrap Verification

**Files:**
- Modify: `scripts/check-placeholders.mjs`
- Create: `scripts/check-placeholders.test.mjs`
- Modify: `shopify.app.toml`
- Modify: `shopify.app.dev.toml`
- Modify: `wrangler.jsonc`
- Review: `scripts/install-skills.mjs`, `scripts/setup-agents.mjs`, `scripts/setup-agents.contract.mjs`, `.codex/config.toml`, `skills-lock.json`, `README.md`

- [ ] Add RED fixture tests for production app URL/client ID, redirect drift, legal identity/contact/effective date, plan handles, public support/privacy/pricing copy, Cloudflare IDs, Partner app ID/token, and unused scopes.
- [ ] Add passing fixture tests proving local development placeholders remain allowed and a fully populated production fixture passes.
- [ ] Check TOML/JSONC/content exports without inventing legal identity, plan handles, resource IDs, or secrets.
- [ ] Run setup in disposable temp roots with isolated `HOME`/`CODEX_HOME`; assert Codex receives `AGENTS.md`, `.codex/config.toml`, Shopify MCP, and locked skills; assert Claude receives the same contract through `.claude/skills` links with no duplicate rule source.
- [ ] Run `npm run test:agent-setup` and `npm run install:skill -- --wait --locked`; verify lockfile unchanged and every locked skill exists for both hosts.
- [ ] Document required secret names, Shopify Partner app ID, Managed Pricing handles, Cloudflare IDs, legal fields, and deploy order in `README.md` and `docs/LEGAL_TEMPLATE.md`.
- [ ] Commit `chore: enforce launch and agent setup contract`.

---

### Phase 9: Final Verification, Review, and Push

- [ ] Read `AGENTS.md`, all changed files, and migration SQL; confirm no unrelated user changes were reverted.
- [ ] Run, capturing output:

```bash
npm run db:migrate:local
npm run typecheck
npm run lint
npm test
npm run test:agent-setup
npm run check:placeholders -- production
npm run build
git diff --check
```

- [ ] Treat placeholder-check failure as expected only when output lists intentional template values; prove populated fixture passes.
- [ ] Run Shopify config validation for both TOML files. If app linking or Partner organization access blocks validation, record exact command and response; do not claim validation passed.
- [ ] Search final runtime tree:

```bash
rg -n "subscription_events|SubscriptionEventRepo|app_subscriptions/update|process\.env|from [\"']~/models/" app workers
```

Require no legacy billing strings, no `process.env`, and no service-to-model imports.
- [ ] Run `git status --short`, inspect staged diff, and commit any final scoped changes.
- [ ] Push `main` only after pre-push verification succeeds: `git push origin main`.
- [ ] Report commit IDs, test counts, intentional template blockers, and any external Shopify validation blocker.

## Completion Criteria

Work is complete only when all phases pass, legacy billing has no runtime references, every tenant-owned table is purge-covered, every status listed by Partner is represented in projections, checkpoints are observable, webhooks are idempotent, and release evidence is recorded. Production identity/resource placeholders may remain only as explicit template inputs that make `check:placeholders -- production` fail until the next project fills them.
