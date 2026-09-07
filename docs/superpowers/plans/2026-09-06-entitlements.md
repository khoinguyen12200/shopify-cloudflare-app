# Reusable Entitlements Implementation Plan

> **For agentic workers:** Execute this plan task by task with strict RED -> GREEN -> REFACTOR. Every production behavior must have a test that was observed failing before implementation.

**Goal:** provide a generic, reusable billing-entitlement subsystem where feature code asks for stable feature keys and never knows Shopify plan handles, storage, billing periods, cache behavior, or quota concurrency.

**Architecture:** the pure policy resolves a catalogue grant from an authoritative subscription snapshot. A service coordinates policy, subscription, quota-usage, and reusable-capacity ports. D1 is authoritative for subscription state, quota reservations, and active capacity allocations; KV is an advisory read cache only. A composition root wires repositories and the service into reusable gates.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, D1/SQLite, Drizzle, KV, existing Shopify Managed Pricing projection.

**Source of truth:** `app/billing/plans.ts` remains the app catalogue and display metadata. `app/domain/` contains no I/O. `app/ports/` contains narrow interfaces. `app/services/` orchestrates. `app/models/` is the only D1 layer. `app/wiring.server.ts` is the only adapter composition root.

This is a reusable template, so the subsystem supports both kinds of limits that
future apps commonly need: consumable quotas (such as AI tokens per month) and
reusable concurrent capacity (such as one active staff member on a Free plan).
The catalogue must make the distinction explicit: a `lifetime` quota is consumed
forever, while a capacity allocation is returned when its owning resource is
deleted or deactivated.

## Invariants

- Feature code imports one service facade and uses stable keys such as `reports.export` and `ai.monthly_tokens`; it never imports `PlanHandle` or compares a handle.
- Unknown catalogue versions, plans, feature keys, malformed grants, missing subscriptions and inactive statuses fail closed.
- `NONE`/missing plan uses the catalogue's explicit free plan. `PENDING`, `FROZEN`, `CANCELED`, and `UNKNOWN` deny access. `CANCELLATION_SCHEDULED` remains active only before its effective cancellation timestamp.
- Counts are non-negative safe integers. A capability has no consumption amount. A capacity limits concurrently active allocations and is reusable when an allocation is released. A quota consumes an amount within an explicit `lifetime`, `calendar_month`, or `billing_period` period.
- Billing-period quotas require both recorded start and end. No code derives a monthly period from an annual billing plan.
- D1 usage writes are shop-scoped and atomic. A reservation checks the current subscription revision and total active reservations in the same transaction/write condition.
- Every consumption operation has a caller-supplied idempotency key. Replaying the same key and identical request returns the original reservation; reusing it with different feature, period, amount, or revision returns `operation_conflict`.
- Quota reservation transitions are `held -> committed` or `held -> released`; committed/released rows cannot transition again. A crash leaves `held` rows for an explicit reconciliation job, never silent expiry. Capacity allocations have a separate reusable lifecycle: `held -> allocated -> released`; releasing an active allocation returns the slot to the plan maximum. Capacity rows are linked to a caller-owned `allocationId` (for example, an active staff-user id), and releasing one allocation is idempotent.
- KV stores only a validated, versioned subscription snapshot or preview. A KV hit is never sufficient to grant a quota reservation. Cache failures and stale entries fall back to D1.
- Tenant deletion purges all entitlement rows and deletes the shop-scoped cache key.

## Public API

Create `app/services/entitlements.server.ts` facade with:

```ts
check(shop: string, key: EntitlementKey): Promise<CheckResult>
reserve(input: { shop: string; key: EntitlementKey; operationId: string; amount: number }): Promise<ReserveResult>
commit(input: { shop: string; operationId: string; actualAmount?: number }): Promise<CommitResult>
release(input: { shop: string; operationId: string }): Promise<ReleaseResult>
allocate(input: { shop: string; key: EntitlementKey; allocationId: string }): Promise<AllocateResult>
deallocate(input: { shop: string; key: EntitlementKey; allocationId: string }): Promise<DeallocateResult>
invalidate(shop: string): Promise<void>
```

`CheckResult` includes `{ allowed, kind, maximum, period, remaining? }` or a closed denial reason. `ReserveResult` includes the reservation id, accepted amount, period, subscription revision, and remaining quota capacity. `AllocateResult` includes the allocation id, subscription revision, and remaining active capacity; `DeallocateResult` confirms the released allocation or an idempotent already-released result. Expected denials use `Result`; programmer errors are thrown only for violated internal invariants.

## Catalogue and pure policy

1. Add typed `FeatureDefinition`, `EntitlementGrant`, `UsagePeriod`, `SubscriptionSnapshot`, `ResolvedEntitlement`, and closed denial reasons under `app/domain/entitlement-policy.ts`.
2. Represent a catalogue as `{ version, freePlan, features, plans }`. Definitions distinguish `capability`, `capacity`, and `quota`. Capacity grants express a concurrent maximum (for example, `staff.max: 1` on Free); quota grants express a consumable maximum plus a period.
3. Implement `resolveEntitlement(catalogue, subscription, key, now)`. Test every status, free fallback, unknown plan/key, prototype key, invalid grant, cancellation timestamp, lifetime, UTC calendar month, billing period, missing bounds, expired period, and safe-integer boundary.
4. Keep plan display strings and prices in `plans.ts`; add a typed grant map there only for this template's example keys. A future app adds keys and grants in one catalogue change.

## Ports and service

1. Add `SubscriptionPort.current(shop)` returning a normalized snapshot with a monotonic revision derived from the projection's applied event.
2. Add `UsagePort.reserve/commit/release/listHeld` for consumable quotas and `CapacityPort.allocate/deallocate/listHeld` for reusable concurrent capacity, all with explicit shop-first parameters and typed results.
3. Add `SubscriptionCachePort.get/put/delete`, where values include catalogue version and snapshot revision.
4. Implement the service as a functional decision shell: load authoritative subscription, resolve pure policy, then call the usage port. `check` may use a short-lived KV preview only for display; `reserve` always reloads authoritative D1 state.
5. Validate operation id, allocation id, amount, period and result invariants at the service boundary. Use caller-provided period only for quota idempotency comparison; derive quota periods internally. Capacity allocation identity is stable for the resource being counted, so deleting/deactivating that resource can release its slot.
6. Add `createPlanGate({ entitlements, key })`, `createQuotaGate({ entitlements, key, amount })`, and `createCapacityGate({ entitlements, key, allocationId })` in `app/billing/gates.ts`. Adapt `AiGate` through `merchantsOnly`; staff/system bypass merchant gates. The AI service reserves before provider work, commits actual usage after success, and releases on provider failure. A staff-management flow allocates `staff.max` before creating an active staff record and deallocates it when that record is deleted or deactivated.

## D1 schema and repository

Create `app/db/schema/entitlements.ts` and migration with:

- `entitlement_operations(shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at)` primary key `(shop, operation_id)` and indexes `(shop, key, period, state)`.
- `entitlement_usage(shop, key, period, committed, held, updated_at)` primary key `(shop, key, period)`.
- `entitlement_allocations(shop, key, allocation_id, subscription_revision, state, created_at, updated_at)` primary key `(shop, key, allocation_id)` and indexes `(shop, key, state)`. State is `held`, `allocated`, or `released`; an active allocation counts toward the concurrent capacity and can be released for reuse.
- Quota operation state is `held`, `committed`, or `released`; capacity allocation state is `held`, `allocated`, or `released`. Amounts are integer, non-negative, and never `REAL`.
- CHECK constraints for amounts and state. All queries include shop.

Repository behavior:

1. Insert-or-read an operation idempotently and reject mismatched replay.
2. In one D1 batch/transaction, update the aggregate only when `committed + held + requested <= maximum` and operation/revision match.
3. Commit moves held to committed and records actual amount; actual amount must be non-negative and no greater than reserved unless the service explicitly supports overage.
4. Release subtracts held exactly once.
5. Capacity allocation inserts or replays `(shop, key, allocation_id)` idempotently, rejects a conflicting revision or key, and atomically allows allocation only when active allocations plus held allocations are below the resolved maximum. `deallocate` transitions `held` or `allocated` to `released` exactly once; replaying it is harmless, and a released allocation does not count toward capacity.
6. Read tests prove another shop cannot observe, reserve, commit, release, allocate, or deallocate rows.
7. Add `entitlement_operations`, `entitlement_usage`, and `entitlement_allocations` to tenant purge coverage and tests.

## KV cache

Create `app/adapters/entitlement-cache.server.ts` using the existing KV binding pattern:

- Key format `entitlements:v1:${shop}`.
- JSON schema includes `catalogueVersion`, `subscriptionRevision`, `status`, `planHandle`, period bounds, and `cachedAt`.
- Reject malformed JSON, wrong version, wrong types, and stale `cachedAt`.
- `put` uses a bounded TTL; `delete` runs after every subscription projection write, including duplicate repair and uninstall.
- Cache tests use real local KV for hit, miss, malformed value, expiry, shop isolation, invalidation, and cache failure fallback.

## Wiring and integration

1. Extend `app/wiring.server.ts` with `subscriptionsPort()`, `entitlementUsagePort()`, `entitlementCapacityPort()`, `entitlementCachePort()`, and `entitlements()` factories.
2. Add a same-named facade import path so routes/features never construct repositories.
3. Update subscription projection writers to invalidate after successful application and repair.
4. Add usage documentation under `docs/entitlements.md` with capability, capacity, quota, AI reserve/commit/release examples and the crash reconciliation procedure.

## Tests and verification order

1. Pure policy tests: RED, run the focused test, GREEN, focused test, refactor.
2. Service fake-port tests: inactive plans, unknown keys, cache fallback, quota reserve/commit/release, capacity allocate/deallocate/reallocate, replay, conflict, and provider failure.
3. D1 integration tests against local bindings: quota and capacity concurrent boundaries, exact limits, zero, safe integer, period isolation, subscription revision race, duplicate delivery, shop isolation, release-and-reuse, and purge.
4. KV integration tests against local bindings.
5. Capacity integration tests proving Free allows one active allocation, rejects a second, permits a new allocation after deallocation, and never leaks a slot on duplicate allocate/deallocate calls. AI gate/service integration tests prove merchant denial, staff bypass, and usage committed only after successful generation.
6. Run `npm run typecheck`, `npm run lint`, focused tests, then `npm test`, then `npm run verify`. Resolve all warnings/errors before commit.

## Delivery checkpoints

- Commit 1: pure policy and typed catalogue.
- Commit 2: service, quota port, and capacity port with fake tests.
- Commit 3: D1 quota usage and capacity allocation schema/repositories/migration with integration tests.
- Commit 4: KV adapter/invalidation and tests.
- Commit 5: gates, wiring, AI integration, purge, docs, full verification.

## Implementation Status

The reusable foundation described above is implemented in this template. The
catalogue, pure policy, quota reservations, reusable capacity allocations,
subscription revision checks, KV preview cache, gates, wiring, tenant purge,
migrations, and documentation are present and covered by tests. The template's
internal admin AI intentionally remains ungated; future applications opt in by
adding their own feature keys and calling the quota/capability gates.

Application-specific staff CRUD flows and provider-specific AI metering are
deliberately not wired here because this repository has no application domain
yet. They use the existing `allocate`/`deallocate` and `reserve`/`commit`/
`release` seams when a concrete project adds those resources.
