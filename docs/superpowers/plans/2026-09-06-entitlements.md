# Reusable Entitlements Implementation Plan

> **For agentic workers:** Execute this plan task by task with strict RED -> GREEN -> REFACTOR. Every production behavior must have a test that was observed failing before implementation.

**Goal:** provide a generic, reusable billing-entitlement subsystem where feature code asks for stable feature keys and never knows Shopify plan handles, storage, billing periods, cache behavior, or quota concurrency.

**Architecture:** the pure policy resolves a catalogue grant from an authoritative subscription snapshot. A service coordinates policy, subscription and usage ports. D1 is authoritative for subscription and usage reservations; KV is an advisory read cache only. A composition root wires repositories and the service into reusable gates.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, D1/SQLite, Drizzle, KV, existing Shopify Managed Pricing projection.

**Source of truth:** `app/billing/plans.ts` remains the app catalogue and display metadata. `app/domain/` contains no I/O. `app/ports/` contains narrow interfaces. `app/services/` orchestrates. `app/models/` is the only D1 layer. `app/wiring.server.ts` is the only adapter composition root.

## Invariants

- Feature code imports one service facade and uses stable keys such as `reports.export` and `ai.monthly_tokens`; it never imports `PlanHandle` or compares a handle.
- Unknown catalogue versions, plans, feature keys, malformed grants, missing subscriptions and inactive statuses fail closed.
- `NONE`/missing plan uses the catalogue's explicit free plan. `PENDING`, `FROZEN`, `CANCELED`, and `UNKNOWN` deny access. `CANCELLATION_SCHEDULED` remains active only before its effective cancellation timestamp.
- Counts are non-negative safe integers. A capability has no consumption amount. A capacity is a held slot. A quota has an explicit `lifetime`, `calendar_month`, or `billing_period` period.
- Billing-period quotas require both recorded start and end. No code derives a monthly period from an annual billing plan.
- D1 usage writes are shop-scoped and atomic. A reservation checks the current subscription revision and total active reservations in the same transaction/write condition.
- Every consumption operation has a caller-supplied idempotency key. Replaying the same key and identical request returns the original reservation; reusing it with different feature, period, amount, or revision returns `operation_conflict`.
- Reservation transitions are `held -> committed` or `held -> released`; committed/released rows cannot transition again. A crash leaves `held` rows for an explicit reconciliation job, never silent expiry.
- KV stores only a validated, versioned subscription snapshot or preview. A KV hit is never sufficient to grant a quota reservation. Cache failures and stale entries fall back to D1.
- Tenant deletion purges all entitlement rows and deletes the shop-scoped cache key.

## Public API

Create `app/services/entitlements.server.ts` facade with:

```ts
check(shop: string, key: EntitlementKey): Promise<CheckResult>
reserve(input: { shop: string; key: EntitlementKey; operationId: string; amount: number }): Promise<ReserveResult>
commit(input: { shop: string; operationId: string; actualAmount?: number }): Promise<CommitResult>
release(input: { shop: string; operationId: string }): Promise<ReleaseResult>
invalidate(shop: string): Promise<void>
```

`CheckResult` includes `{ allowed, kind, maximum, period, remaining? }` or a closed denial reason. `ReserveResult` includes the reservation id, accepted amount, period, subscription revision, and remaining capacity. Expected denials use `Result`; programmer errors are thrown only for violated internal invariants.

## Catalogue and pure policy

1. Add typed `FeatureDefinition`, `EntitlementGrant`, `UsagePeriod`, `SubscriptionSnapshot`, `ResolvedEntitlement`, and closed denial reasons under `app/domain/entitlement-policy.ts`.
2. Represent a catalogue as `{ version, freePlan, features, plans }`. Definitions distinguish `capability`, `capacity`, and `quota`.
3. Implement `resolveEntitlement(catalogue, subscription, key, now)`. Test every status, free fallback, unknown plan/key, prototype key, invalid grant, cancellation timestamp, lifetime, UTC calendar month, billing period, missing bounds, expired period, and safe-integer boundary.
4. Keep plan display strings and prices in `plans.ts`; add a typed grant map there only for this template's example keys. A future app adds keys and grants in one catalogue change.

## Ports and service

1. Add `SubscriptionPort.current(shop)` returning a normalized snapshot with a monotonic revision derived from the projection's applied event.
2. Add `UsagePort.reserve/commit/release/listHeld` with explicit shop-first parameters and typed results.
3. Add `SubscriptionCachePort.get/put/delete`, where values include catalogue version and snapshot revision.
4. Implement the service as a functional decision shell: load authoritative subscription, resolve pure policy, then call the usage port. `check` may use a short-lived KV preview only for display; `reserve` always reloads authoritative D1 state.
5. Validate operation id, amount, period and result invariants at the service boundary. Use caller-provided period only for idempotency comparison; derive the period internally.
6. Add `createPlanGate({ entitlements, key })` and `createQuotaGate({ entitlements, key, amount })` in `app/billing/gates.ts`. Adapt `AiGate` through `merchantsOnly`; staff/system bypass merchant gates. The AI service reserves before provider work, commits actual usage after success, and releases on provider failure.

## D1 schema and repository

Create `app/db/schema/entitlements.ts` and migration with:

- `entitlement_operations(shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at)` primary key `(shop, operation_id)` and indexes `(shop, key, period, state)`.
- `entitlement_usage(shop, key, period, committed, held, updated_at)` primary key `(shop, key, period)`.
- State enum `held`, `committed`, `released`; amounts integer, non-negative, no REAL.
- CHECK constraints for amounts and state. All queries include shop.

Repository behavior:

1. Insert-or-read an operation idempotently and reject mismatched replay.
2. In one D1 batch/transaction, update the aggregate only when `committed + held + requested <= maximum` and operation/revision match.
3. Commit moves held to committed and records actual amount; actual amount must be non-negative and no greater than reserved unless the service explicitly supports overage.
4. Release subtracts held exactly once.
5. Read tests prove another shop cannot observe, reserve, commit, or release rows.
6. Add `entitlement_operations` and `entitlement_usage` to tenant purge coverage and tests.

## KV cache

Create `app/adapters/entitlement-cache.server.ts` using the existing KV binding pattern:

- Key format `entitlements:v1:${shop}`.
- JSON schema includes `catalogueVersion`, `subscriptionRevision`, `status`, `planHandle`, period bounds, and `cachedAt`.
- Reject malformed JSON, wrong version, wrong types, and stale `cachedAt`.
- `put` uses a bounded TTL; `delete` runs after every subscription projection write, including duplicate repair and uninstall.
- Cache tests use real local KV for hit, miss, malformed value, expiry, shop isolation, invalidation, and cache failure fallback.

## Wiring and integration

1. Extend `app/wiring.server.ts` with `subscriptionsPort()`, `entitlementUsagePort()`, `entitlementCachePort()`, and `entitlements()` factories.
2. Add a same-named facade import path so routes/features never construct repositories.
3. Update subscription projection writers to invalidate after successful application and repair.
4. Add usage documentation under `docs/entitlements.md` with capability, capacity, quota, AI reserve/commit/release examples and the crash reconciliation procedure.

## Tests and verification order

1. Pure policy tests: RED, run the focused test, GREEN, focused test, refactor.
2. Service fake-port tests: inactive plans, unknown keys, cache fallback, reserve/commit/release, replay, conflict, provider failure.
3. D1 integration tests against local bindings: concurrent boundary, exact limit, zero, safe integer, period isolation, subscription revision race, duplicate delivery, shop isolation, purge.
4. KV integration tests against local bindings.
5. AI gate/service integration tests proving merchant denial, staff bypass, and usage committed only after successful generation.
6. Run `npm run typecheck`, `npm run lint`, focused tests, then `npm test`, then `npm run verify`. Resolve all warnings/errors before commit.

## Delivery checkpoints

- Commit 1: pure policy and typed catalogue.
- Commit 2: service and ports with fake tests.
- Commit 3: D1 schema/repository/migration and integration tests.
- Commit 4: KV adapter/invalidation and tests.
- Commit 5: gates, wiring, AI integration, purge, docs, full verification.
