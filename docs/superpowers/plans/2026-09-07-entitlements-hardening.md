# Entitlement Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the entitlement subsystem a correctness-safe, app-neutral template foundation that a future project can configure and use immediately for capabilities, reusable capacity, and consumable quotas.

**Architecture:** Keep policy pure and app-independent, expose narrow typed ports, and keep all D1 access inside models. The service resolves an authoritative subscription snapshot, derives a concrete usage period, and delegates atomic state transitions to repositories. KV remains advisory only. Examples document configuration and call patterns without adding staff, AI, or other business-domain code.

**Tech Stack:** TypeScript, Vitest, Drizzle ORM, Cloudflare D1/SQLite, Cloudflare KV, React Router/Workers.

**Spec:** `docs/superpowers/plans/2026-09-06-entitlements.md` and the review findings confirmed in this plan.

## Global Constraints

- Follow strict RED -> verify RED -> GREEN -> verify GREEN -> refactor for every production behavior.
- Domain code performs no I/O and does not call `Date.now()`; clocks enter through arguments or service dependencies.
- Only `app/models/*.server.ts` touches Drizzle; every query is shop-scoped.
- No `any`, `as`, `@ts-ignore`, `eslint-disable`, skipped tests, fake green tests, or swallowed errors.
- Expected operational failures use typed `Result` unions; programmer invariant violations may throw.
- D1 stores entitlement amounts as non-negative safe integers; no floating-point usage accounting.
- The template remains app-neutral: no real staff table/CRUD, merchant AI provider, Shopify plan handles in feature code, or paywall UI.

## Confirmed Review Findings

The review is correct and each finding is addressed below: the repository uses read-then-write sequences that can race; capacity skips the required `held` state; quota reservations persist abstract period names instead of concrete period keys; public result types are loose; cache validation uses unchecked casts and omits required field checks; and the compressed implementation includes `as` casts and violates maintainability/contracts. These are implementation defects, not reasons to add app-specific behavior.

## File Map

- Modify `app/domain/entitlement-policy.ts`: concrete period derivation and pure validation helpers.
- Modify `app/ports/entitlements.ts`: stable typed result and repository port contracts.
- Modify `app/services/entitlements.server.ts`: orchestration, validation, and typed results.
- Modify `app/models/entitlements.server.ts`: atomic D1 transitions and reconciliation queries.
- Modify `app/adapters/entitlement-cache.server.ts`: cast-free runtime parser and complete snapshot validation.
- Modify `app/wiring.server.ts`: explicit typed template catalogue and adapter factories.
- Add/modify focused tests beside each unit plus D1/KV integration tests under existing test conventions.
- Add `docs/entitlements-template.md`: app-neutral configuration, examples, and launch checklist.
- Modify `docs/entitlements.md`: align usage examples with final API and period semantics.
- Add a Drizzle migration only if schema constraints/indexes require it; verify journal and snapshot together.

### Task 1: Lock the public contract and period model

Status: complete. Concrete lifetime, UTC-month, and billing-period windows are
implemented and covered by policy/service tests.

**Files:** `app/domain/entitlement-policy.test.ts`, `app/domain/entitlement-policy.ts`, `app/ports/entitlements.ts`, `app/services/entitlements.server.test.ts`

- [x] Write failing tests for concrete period keys: `lifetime`, UTC `YYYY-MM`, and billing period `start:end`; reject missing/expired billing bounds.
- [x] Run focused policy tests and observe failure caused by abstract period output.
- [x] Define `UsageWindow` and typed `CheckResult`, `ReserveResult`, `CommitResult`, `ReleaseResult`, `AllocateResult`, and `DeallocateResult` unions with closed denial reasons.
- [x] Implement pure `resolveUsageWindow(period, now, subscription)` and update `ResolvedEntitlement` to carry the derived window for quotas.
- [x] Run policy/service tests and confirm green.
- [x] Refactor long lines into focused functions without changing behavior; commit.

### Task 2: Replace inferred catalogue metadata with explicit typed configuration

Status: complete. `ENTITLEMENT_CATALOGUE` contains explicit definitions and
grants for capability, capacity, and quota examples.

**Files:** `app/billing/plans.ts`, `app/wiring.server.ts`, `app/billing/gates.ts`, related tests

- [x] Write a failing type/runtime test proving a feature's kind and quota period come from explicit catalogue definitions, not key naming conventions.
- [x] Verify RED.
- [x] Add a small typed example catalogue containing `reports.export` capability, `staff.max` capacity, and `documents.monthly` quota; keep display names/prices separate.
- [x] Wire factories from that catalogue and remove `.monthly`/`.max` string inference.
- [x] Verify focused tests and typecheck green; commit.

### Task 3: Make quota reservation atomic and idempotent

Status: complete. Conditional D1 aggregate updates and idempotent operation
replays prevent concurrent over-allocation.

**Files:** `app/models/entitlements.server.ts`, `app/db/schema/entitlements.ts`, `app/services/entitlements.server.test.ts`, D1 integration tests

- [x] Write failing local-D1 tests launching concurrent reservations whose total equals/exceeds the maximum, plus replay/conflict and shop-isolation cases.
- [x] Verify RED and capture the race/incorrect result.
- [x] Implement a single atomic D1 transaction/batch strategy: insert the operation idempotently, conditionally increment aggregate usage only when `committed + held + amount <= maximum`, and roll back/return a typed denial if any condition fails.
- [x] Add revision and concrete period predicates to the same write path; use conditional state transitions for commit/release.
- [x] Verify concurrent, replay, conflict, exact-limit, zero, safe-integer, and period-isolation tests green; commit.

### Task 4: Implement reusable capacity lifecycle atomically

Status: complete. Capacity allocation/release and concurrent one-slot behavior
are covered by local D1 tests.

**Files:** `app/models/entitlements.server.ts`, `app/ports/entitlements.ts`, capacity tests

- [x] Write failing tests for `held -> allocated -> released`, duplicate allocate/deallocate, release-and-reuse, concurrent maximum-one allocation, and revision conflict.
- [x] Verify RED.
- [x] Implement atomic capacity hold/allocate using shop/key/allocation identity and active-state count; ensure released rows do not count and retries are idempotent.
- [x] Implement conditional transitions so a row cannot be allocated twice or released twice; return typed remaining capacity.
- [x] Verify all capacity tests and full typecheck green; commit.

### Task 5: Harden cache parsing and invalidation

Status: complete. Cache parsing validates persisted fields, bounded timestamps,
TTL, malformed values, and shop-scoped invalidation. Projection adapters,
duplicate repairs, uninstall handling, and tenant purge now invalidate the
entitlement key.

**Files:** `app/adapters/entitlement-cache.server.ts`, cache tests, subscription projection tests

- [x] Write failing tests for malformed JSON, wrong catalogue version, invalid status/plan/revision, invalid optional timestamps, stale/future timestamps, shop isolation, KV failures, and cache invalidation after projection repair/uninstall.
- [x] Verify RED.
- [x] Replace unchecked casts with `unknown` narrowing/type guards that validate every persisted field before returning a snapshot; enforce bounded TTL and reject future timestamps.
- [x] Verify cache tests and projection invalidation tests green; commit.

### Task 6: Add generic held-state reconciliation

Status: complete. Held quota and capacity records can be listed by shop and
processed only through explicit idempotent decisions.

**Files:** `app/ports/entitlements.ts`, `app/models/entitlements.server.ts`, `app/services/entitlement-reconciliation.server.ts`, tests

- [x] Write failing tests for listing held quota operations/capacity allocations by shop and applying explicit commit/release or allocate/deallocate decisions idempotently.
- [x] Verify RED.
- [x] Add narrow list ports and a pure reconciliation decision function; add a service entry point that never guesses ownership and never silently expires rows.
- [x] Verify reconciliation tests and shop isolation green; commit.

### Task 7: Final integration contract and documentation

Status: complete. Gates and app-neutral handoff documentation use the final
`allowed` result contract and concrete period semantics.

**Files:** `app/billing/gates.ts`, gate tests, `docs/entitlements-template.md`, `docs/entitlements.md`

- [x] Write failing contract tests showing future feature code can use capability, quota, and capacity gates without importing plans, repositories, Shopify, or app tables.
- [x] Verify RED.
- [x] Finalize gate signatures with typed results and explicit examples for one active resource forever, lifetime quota, monthly quota, and billing-period quota.
- [x] Document what a new project must provide: feature key catalogue, plan grants, stable allocation IDs, idempotency IDs, usage measurement, reconciliation trigger, subscription projection hookup, and migration deployment.
- [x] Document what must remain outside the template: business resources, provider adapters, merchant UI, and app-specific authorization.
- [x] Verify docs examples compile conceptually against the final signatures; commit.

### Task 8: Full verification and delivery audit

Status: complete. Typecheck, lint, focused entitlement tests, full worker/DOM
test suites, and `git diff --check` pass after the audit follow-up.

- [x] Run `npm run typecheck`.
- [x] Run `npm run lint` and confirm no cast/style contract violations.
- [x] Run focused domain/service/D1/KV tests.
- [x] Run `npm test` and `npm run verify`.
- [x] Run `git diff --check`, inspect migration metadata, and confirm every plan invariant has a test.
- [x] Update this plan with completion status only after observed green output; commit the implementation as separate logical commits.

## Acceptance Criteria

- Two concurrent quota reservations can never exceed the configured maximum.
- Two concurrent capacity allocations can never exceed the configured active maximum.
- Capacity follows `held -> allocated -> released`; released capacity is reusable forever.
- Quota period values are concrete and deterministic; lifetime never resets, UTC months reset, billing periods require recorded bounds.
- Replays are idempotent; mismatched operation identity, amount, period, key, or revision returns `operation_conflict`.
- All public methods return typed results with closed expected-failure reasons.
- Cache values are fully runtime-validated without casts and never authorize writes.
- Every entitlement query is shop-scoped and tenant purge removes all entitlement state.
- A future project can configure the catalogue and call gates without modifying entitlement internals.
- No app-specific staff/AI/business implementation is included.

## Audit Follow-up (2026-09-07)

- Public operation results are closed and carry operation/allocation identity,
  concrete period, subscription revision, and aggregate remaining capacity.
- Quota and capacity admission writes verify the supplied revision against the
  current D1 subscription projection in the same conditional write path.
- Replays calculate remaining usage from aggregate committed/held usage and
  remaining capacity from all active/held allocations; `operation_conflict` is
  preserved as a distinct denial.
- Entitlement KV invalidation is wired after projection application or repair,
  history projection delivery, uninstall, and tenant purge.
- The entitlement service is split into focused preview, authoritative snapshot,
  check, reserve, and allocation helpers rather than one compressed function.
