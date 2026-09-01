# Lifecycle Foundation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish a correct Shopify Managed Pricing lifecycle base with one authoritative event source, complete tenant erasure, and deploy-blocking launch configuration.

**Architecture:** Partner Historical Events is immutable billing and relationship truth. `shops` and `shop_subscriptions` are ordered projections. Webhooks are transport observations only. A dedicated purge adapter deletes all tenant-owned D1/KV/R2 data. No legacy `subscription_events` access survives migration.

**Tech Stack:** React Router, TypeScript, Vitest, D1, KV, R2, Queues, Shopify Partner API 2026-07.

**Spec:** `docs/superpowers/specs/2026-09-01-shopify-lifecycle-foundation-design.md`

## Global Constraints

- TDD: every behavior starts with one focused failing test and observed RED.
- Only models query D1. Services depend on ports. Routes/workers only parse, dispatch, respond.
- Partner API operations must be searched and schema-validated at `2026-07`.
- Use managed pricing projections only; delete legacy billing source, model, schema, migration path, and UI references together.
- Never persist raw webhook or Partner payload JSON. Money uses integer minor units and currency.
- Every tenant table, KV session, R2 object, and queued work is scoped and erased by `shop/redact`.

---

### Task 1: Typed Partner Event Adapter

**Files:**
- Modify: `app/ports/shopify-partner.ts`, `app/adapters/shopify-partner.server.ts`, `app/adapters/shopify-partner.test.ts`
- Create: `app/adapters/shopify-partner-events.ts`, `app/adapters/shopify-partner-events.test.ts`

**Produces:** `ShopifyPartnerPort.listHistoricalEvents({ appId, shopId, cursor, occurredAtMin })` and `activeSubscription` with validated typed results.

- [ ] Add failing adapter tests for HTTP failure, GraphQL errors, page cursor, relationship event, subscription event, and unknown event.
- [ ] Run adapter tests. Expect missing parser/port failures.
- [ ] Validate one `events` query with `edges/node/id/occurredAt/eventType/shop` plus each required concrete fragment; validate Active Subscription query.
- [ ] Parse only supported typed fields. Represent unknown event as `{ kind: "ignored" }`; do not retain raw JSON.
- [ ] Run adapter tests, typecheck, lint. Commit `feat: add typed Partner history adapter`.

### Task 2: Event Ledger and Ordered Projections

**Files:**
- Modify: `app/models/shopify-events.server.ts`, `app/models/shops.server.ts`, `app/db/schema/lifecycle.ts`
- Create: `app/models/shop-subscriptions.server.ts`, `app/models/shop-subscriptions.test.ts`
- Modify: `app/models/shopify-events.test.ts`, `app/models/shops.test.ts`

**Produces:** transactional `recordAndProject(event)` and `upsertObservation(shop, subscription)`.

- [ ] Add RED integration tests: duplicate Partner ID does not mutate; late relationship/subscription events cannot regress a projection; separate shops cannot be read or written across scope.
- [ ] Run model tests. Expect absent projection methods.
- [ ] Insert immutable event + typed child rows; only apply state-machine result after insert wins; persist all current subscription item prices as minor units/currency.
- [ ] Add checkpoint repository methods: `read`, `markSucceeded`, `markFailed`.
- [ ] Run migration generation; inspect only additive/forward SQL; run local migration and model tests. Commit `feat: project Partner lifecycle events`.

### Task 3: Reconciliation Use Cases

**Files:**
- Create: `app/services/reconcile-shopify-history.ts`, `app/services/reconcile-shopify-history.test.ts`, `app/services/reconcile-subscription.ts`, `app/services/reconcile-subscription.test.ts`
- Modify: `app/services/scheduled.server.ts`, `app/shopify.server.ts`, `app/wiring.server.ts`, `workers/app.ts`

**Produces:** `reconcileHistory(deps, now)` and `refreshSubscription(deps, shop)`.

- [ ] Add RED pure-service tests for 250-item cursor paging, overlap dedupe, checkpoint advance only after all pages succeed, partner failure recording, and no per-row Active Subscription request.
- [ ] Add RED tests for an authoritative active subscription replacing stale status, and a null response becoming `NONE` without deleting history.
- [ ] Implement use cases through Partner/checkpoint/projection ports. Use a fixed overlap window passed by clock; never query a model from service.
- [ ] Wire one guarded scheduled sweep and targeted refresh after authenticated access/billing return. Missing app ID/token writes observable failure; never guesses free plan.
- [ ] Run service/scheduled/billing tests, typecheck, lint. Commit `feat: reconcile Shopify pricing history`.

### Task 4: Remove Legacy Billing Completely

**Files:**
- Delete: `app/models/subscription-events.server.ts`, its tests, `app/billing/subscription-event.ts`, its tests, legacy subscription schema table via forward migration
- Modify: `app/db/schema/billing.ts`, `app/db/schema.ts`, `app/billing/dashboard-stats.ts`, all `app/routes/internal/{dashboard,shops,subscriptions,support}/**`
- Create: projection query model/tests for internal list/detail/support contexts

**Produces:** all views query relationship/subscription projections, no `subscription_events` symbol/string remains outside migration history.

- [ ] Add RED rendering/data tests: installed paid, cancellation scheduled paid, frozen free, deactivated free, uninstalled free; assert MRR and support labels agree.
- [ ] Run affected tests. Expect old-event dependencies.
- [ ] Replace repository callers with projection model. Delete old source, old tests, and forward-drop old table only after existing rows are migrated into normalized history.
- [ ] Search `rg 'subscription_events|app_subscriptions/update|SubscriptionEventRepo' app` and require no result.
- [ ] Run full tests and migration locally. Commit `refactor: use managed pricing projections only`.

### Task 5: Dedicated Tenant Erasure

**Files:**
- Create: `app/models/tenant-purge.server.ts`, `app/models/tenant-purge.test.ts`
- Modify: `app/services/compliance.server.ts`, compliance tests, `app/session-storage.server.ts`, `workers/app.ts`

**Produces:** `TenantPurgeRepo.prepare(shop)` and `deleteTenantRows(shop)`.

- [ ] Add RED two-tenant integration test seeding support/messages/attachments, notification logs/preferences/opt-outs, AI runs, lifecycle ledger/projections, scope records, deliveries, queued scope observations, and legacy migration data.
- [ ] Add RED KV/R2 test that only target shop sessions/attachment keys disappear; stale queue work is acknowledged without effect after erasure.
- [ ] Implement R2-first deletion, then one D1 batch transaction, then unconditional KV deletion. Move cross-table deletion out of `ShopRepo`.
- [ ] Add schema inventory guard: a table with `shop` cannot be excluded from purge test fixture.
- [ ] Make customer compliance outcomes explicit no-customer-data with `implemented: true` only after inventory test proves no customer identifiers exist.
- [ ] Run compliance suite/full tests. Commit `feat: complete tenant erasure workflow`.

### Task 6: Launch Contract and Agent Bootstrap

**Files:**
- Modify: `scripts/check-placeholders.mjs`; create `scripts/check-placeholders.test.mjs`
- Modify: `shopify.app.toml`, `shopify.app.dev.toml`, `wrangler.jsonc`, `README.md`
- Review/commit existing: `.codex/config.toml`, `scripts/setup-agents.mjs`, `scripts/setup-agents.contract.mjs`, `scripts/install-skills.mjs`, `skills-lock.json`, package files

**Produces:** deploy guard rejects app URL/client ID/redirect/legal/contact/plan-handle/resource placeholders; `npm install` provisions skills/rules/MCP for Codex and Claude.

- [ ] Add RED fixture tests for every prohibited placeholder and redirect drift; permit local-only placeholders while rejecting production.
- [ ] Test setup script in disposable HOME/CODEX_HOME fixtures: Codex gets `AGENTS.md` contract/config/skills and Claude gets same source contract/skills without duplicated rule truth.
- [ ] Implement parser checks against TOML/JSONC/content exports. Never invent business identity, legal copy, app ID, Partner token, plan handle, or Cloudflare IDs.
- [ ] Document exact required secrets/resources and setup commands.
- [ ] Run `npm run install:skill`, `npm run test:agent-setup`, launch contract suite. Commit `chore: enforce launch and agent setup contract`.

### Task 7: Final Gate and Release Evidence

**Files:** no product behavior changes.

- [ ] Run `npm run db:migrate:local`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:placeholders`, `npm run build`, and `git diff --check`.
- [ ] Run Shopify config validation for both TOML files. If Partner access/linking blocks it, record exact command/response; do not report validation as passed.
- [ ] Inspect all lifecycle commits and worktree. Commit only scoped lifecycle/agent-bootstrap files; retain unrelated changes untouched.
- [ ] Push `main` only after fresh pre-push verification succeeds.

## Coverage Check

- Partner history, Active Subscription, cursor overlap, state machine ordering: Tasks 1-3.
- No legacy billing truth or stale paid status: Task 4.
- All D1/KV/R2 tenant data and stale queue work: Task 5.
- Production launch and Codex/Claude install contract: Task 6.
- Fresh full evidence and explicit external blockers: Task 7.
