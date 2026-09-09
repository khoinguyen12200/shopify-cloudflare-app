# Entitlements Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, or superpowers:subagent-driven-development if the user selects delegated execution. Steps use checkbox (`- [ ]`) syntax for tracking. Do not implement this document merely because it exists.

**Goal:** Fix every entitlement review finding and close the lifecycle, authorization, concurrency, recovery, and coverage gaps without adding an application-specific business domain.

**Architecture:** Authorize from a fresh, uniquely selected D1 subscription projection; KV is display-only. Use a real projection revision to fence new admissions. Quota operations and capacity activation attempts have explicit replay results and atomic state transitions; the application confirms side effects through generic ports rather than the repository guessing ownership.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers, D1/SQLite, Drizzle, KV, Shopify Partner API and the existing subscription reconciliation infrastructure.

**Spec:** `docs/superpowers/plans/2026-09-06-entitlements.md`, `docs/superpowers/plans/2026-09-07-entitlements-hardening.md`, and the review disposition and amended contracts in this document. This plan supersedes conflicting API details in those plans, not their app-neutral scope.

**Status:** Proposed; no implementation tasks completed. Creating this file is not evidence that any fix or regression test has been implemented.

## Global Constraints

- Follow `AGENTS.md` and its linked rules. No production change without a failing test observed first; preserve existing test strength.
- Every behavior follows RED -> verify RED -> GREEN -> verify GREEN -> refactor. A test already passing is existing coverage, not a reproduced defect.
- Tests use real local D1/KV/Queues. Fake Shopify/provider responses only at the external HTTP boundary; no model/service mocks to manufacture green results.
- The functional core takes clocks and data as arguments. Services depend on ports, not adapters. Only `app/models/*.server.ts` performs database queries.
- Wiring stays in `app/wiring.server.ts`. Keep files below 700 lines and functions below 60 lines; target 400/40. No casts, `any`, ignored type errors, or mutable module state.
- Expected denials and lifecycle conflicts are closed typed results. Infrastructure failures are reported or propagated; they must not become success or a free subscription.
- All entitlement reads/writes and recovery actions are shop-scoped. Tenant deletion must remove any new table/state and must not resurrect authorization through an absent-row fallback.
- Money remains integer minor units plus currency through `~/money`. Entitlement quantities are non-negative safe integers, not floating-point accounting.
- Consult the matching Shopify AI Toolkit skill before changing Shopify fields, status mappings, or configuration. Search current pinned documentation, validate any changed GraphQL operation, and record source URLs and version.
- No merchant UI, staff tables, AI provider metering, resource CRUD, or new infrastructure service. Internal staff AI remains intentionally ungated.
- Do not silently expire held work. Unknown side-effect outcomes remain held pending an explicit ownership decision.
- Commit logical tasks only after their verification passes. Do not amend previous commits or change existing completion claims until the new audit is complete.

## Review Disposition And Corrections

The prior review identifies useful defects, but execution must verify them rather than copy every interpretation literally.

| ID | Finding or risk | Disposition | Task |
| --- | --- | --- | --- |
| R1 | History drops `cancelEffectiveOn` | Preserve cancellation metadata and establish precise boundary through authoritative refresh | 2 |
| R2 | Capability gate uses KV preview | Make `check` authoritative; separate display preview | 3 |
| R3 | Concurrent same-ID allocation returns exhaustion | Atomic idempotent admission and replay | 7 |
| R4 | Allocation ignores confirmation result | Explicit conditional confirmation with attempt identity | 7 |
| R5 | Caller crash leaks an already-allocated slot | Keep admission held until caller confirms ownership | 7, 8 |
| R6 | Timestamp-only revision misses event-ID ties | Unique current projection and monotonic revision | 4 |
| R7 | SQLite affinity accepts fractional amounts | Integer-type and relational constraints plus migration | 5 |
| R8 | Concurrent limit change returns negative remaining | Bounded result contract for new and replayed admissions | 9 |
| R9 | Terminal quota replay looks like permission to rerun work | State-bearing replay and idempotent finalization | 6 |
| R10 | Multiple projection rows make current selection ambiguous | Deterministic migration and one current row per shop | 4 |
| R11 | Stale active projections can retain access | Bounded freshness, refresh-on-stale, explicit failures | 3 |
| R12 | Missing edge-case and clean-code coverage | Lifecycle matrix, docs, removal of obsolete seams, final verification | 1, 10, 11 |

Important corrections and qualifications:

- The local cron is every five minutes; production currently runs daily (`30 3 * * *` in `wrangler.jsonc`). Do not claim a five-minute production revocation guarantee from that schedule.
- A billing-cycle end is a renewal boundary, not proof of cancellation. Do not turn every `ACTIVE` subscription into `CANCELED` at `periodEnd`; refresh its state and bounds. A trial ending also does not by itself mean access should be revoked.
- Partner `SubscriptionStatus.cancelEffectiveOn` is a **Date**, not an exact **DateTime**. Do not invent midnight UTC semantics. Preserve the date and resolve an exact cancellation boundary from documented authoritative subscription data.
- The history writer preserves an existing cancellation timestamp when the incoming value is absent. The definite defect is that history normalization discards the date, so missing or obsolete metadata cannot be repaired through that path; it does not unconditionally overwrite all existing timestamps with null.
- A concurrent release after an allocation's successful linearization point can be a legitimate later operation. The contract must identify that point, prevent stale confirmations from touching a later activation, and never claim an unperformed transition succeeded.
- SQLite fraction rejection is defense in depth: the service already validates ordinary amounts, but the schema promises the same invariant and must enforce it.
- Freshness and over-limit resource treatment are policies, not Shopify constants. The template supplies an explicit freshness setting and leaves resource suspension/deletion to the application.
- Green current tests do not prove previous RED runs, all edge cases, or real-store cancellation behavior. Do not retroactively claim those were observed.

## Contract Decisions

### Subscription And Authorization

1. `check(shop, key)` is an authorization decision. It never grants from KV.
2. Add `preview(shop, key)` for display-only use. Its result contains `authoritative: false`; gate constructors cannot accept a preview as authorization.
3. A missing/uninitialized subscription is distinct from an authoritative `NONE`. Missing initialization denies with `subscription_unavailable`; a successfully observed `NONE` uses the explicit free catalogue plan.
4. Track `verifiedAt` separately from Shopify event ordering and `revision`. The template default `maxSnapshotAgeMs` is 300,000, injected through wiring and documented as a configurable policy, not a Shopify guarantee.
5. For an initialized but stale snapshot, or an expired billing window that requires new bounds, attempt one authoritative subscription refresh and reload D1. Refresh failure denies new work with `subscription_unavailable`; do not extend freshness using cached or failed responses.
6. Known uninstall/deactivation and confirmed inactive status deny new merchant work. Historical observations can revoke access, but do not certify a current active read or extend `verifiedAt`.
7. A scheduled cancellation denies at its verified effective timestamp. Missing exact metadata triggers refresh and fails closed if unresolved. Resume/replacement clears obsolete cancellation and pending-plan metadata.
8. Projection event ordering uses `(occurredAt, externalId)`. A separate non-negative integer `revision` advances atomically whenever entitlement-relevant projection values change; duplicate repair without such a change does not advance it. Refreshing only `verifiedAt` must not invalidate reservations.
9. New quota/capacity admissions fence revision and time validity in the same database admission path. Accepted in-flight work may settle after cancellation or downgrade; settlement is not a new grant.

### Quota Operation Contract

- `reserve({ shop, key, operationId, amount })` derives the concrete period internally for a **new** operation.
- Successful results retain identity, reserved amount, period, original revision and remaining, and add `state: "held" | "committed" | "released"` and `replayed: boolean`.
- Resolve an existing operation before creating a new admission. Matching retries return its original period/revision even across renewal, cancellation, or refresh; a different key or amount returns `operation_conflict`.
- The caller does not supply a revision or period to the public API. Repository calls that explicitly reuse an ID with different period/revision continue to reject that mismatch. This distinction supersedes the old public replay behavior, which recomputed an identity the caller could not control.
- A replay is never permission to blindly repeat a side effect. Terminal states are returned without new work; held retries consult the application's idempotent operation record or provider idempotency key.
- Repeating `commit` with the same actual amount returns the original success without another accounting write. A different actual amount conflicts. Omitted actual amount means the original reserved amount, consistently on first call and replay.
- Repeating `release` is harmless. A committed operation cannot be released; return its committed state explicitly rather than implying a refund.
- Reservations require a positive safe integer; actual usage may be zero. Document this distinction instead of silently treating zero reservation input as supported.

### Capacity Activation Contract

- Keep `allocationId` as the stable resource identity and add a caller-supplied `operationId` for each activation attempt. Duplicate attempts reuse it; reactivation after release uses a new operation ID.
- `allocate({ shop, key, allocationId, operationId })` admits a **held** slot. Both held and allocated attempts count against the limit.
- Add `confirmAllocation({ shop, key, allocationId, operationId })` to transition `held -> allocated` after the caller's resource creation/activation has succeeded.
- `deallocate({ shop, key, allocationId, operationId })` releases that attempt. A stale release or confirmation must never change a newer activation of the same resource.
- Successful allocation results include state, replay indication, operation ID, allocation ID, original revision and remaining. Terminal replay never silently reactivates a released attempt.
- Persist attempt history and enforce at most one held/allocated attempt per `(shop, key, allocationId)`. Use a shop-scoped unique operation identity and a partial unique active-resource index, or an equivalent proven schema.
- Repeating confirmation of the same allocated attempt succeeds without rewriting it; confirming a released attempt fails. Cross-key/resource reuse of an operation ID conflicts.
- These changes intentionally replace automatic held-to-allocated promotion. Update every gate, fixture, reconciliation port and example together; do not keep an unsafe compatibility wrapper.

### Result And Recovery Semantics

- Returned `remaining` is advisory, bounded to `[0, Number.MAX_SAFE_INTEGER]`, and associated with the admission's limit/revision. It is not a second authorization mechanism or a guarantee against subsequent concurrent writes.
- Both kinds of holds expose enough identity and timestamps to let the caller investigate ownership. Age alone is never a release decision.
- Reconciliation accepts explicit typed decisions, including measured quota actual amount. An asynchronous decision provider may inspect application ownership through a port.
- The template cannot guarantee exactly-once external effects from a database reservation alone. Examples must pair these seams with application/provider idempotency and distinguish failed effects from unknown outcomes.

## File Map

| Area | Files and responsibilities |
| --- | --- |
| Policy | `app/domain/entitlement-policy.ts`, `app/domain/entitlement-policy.test.ts`: status, concrete windows, freshness and result bounds |
| Lifecycle | `app/domain/subscription-lifecycle.ts`, `app/domain/subscription-lifecycle.test.ts`: event ordering and explicit transitions |
| Public contracts | `app/ports/entitlements.ts`, `app/ports/entitlement-reconciliation.ts`: typed replay, confirmation, observation freshness and recovery |
| Service | `app/services/entitlements.server.ts`, `app/services/entitlements.server.test.ts`: authorization, replay lookup and orchestration |
| Entitlement persistence | `app/models/entitlements.server.ts`, `app/models/entitlements.test.ts`: facade and shop-scoped lifecycle writes; if split, use `app/models/entitlement-usage.server.ts` and `app/models/entitlement-capacity.server.ts` |
| Schema | `app/db/schema/entitlements.ts`, `app/db/schema/entitlements.test.ts`, `app/db/schema/lifecycle.ts`: accounting, activation attempts and current subscription projection |
| Projection | `app/models/shop-subscriptions.server.ts`, `app/models/shop-subscriptions.test.ts`, `app/models/shopify-events.server.ts`: one ordered current projection, revision and writer consistency |
| Shopify seam | `app/ports/shopify-partner.ts`, `app/adapters/shopify-partner-events.ts`, `app/adapters/shopify-partner.server.ts` and adjacent tests |
| Refresh | `app/services/reconcile-shopify-history.ts`, `app/services/reconcile-subscription.ts` and adjacent tests: cancellation metadata and authoritative observation |
| KV | `app/adapters/entitlement-cache.server.ts`, `app/adapters/entitlement-cache.server.test.ts`: display-only, versioned values and real-KV tests |
| Recovery | `app/services/entitlement-reconciliation.server.ts`, adjacent tests, `app/wiring/entitlement-reconciliation.test.ts` |
| Wiring/gates | `app/wiring.server.ts`, `app/billing/gates.ts`, `app/billing/gates.test.ts`, `app/wiring/composition-root.test.ts` |
| Deletion | `app/models/tenant-purge.server.ts`, `app/models/tenant-purge.test.ts`, `app/services/tenant-purge.server.ts`, adjacent tests |
| Documentation | `docs/entitlements.md`, `docs/entitlements-template.md`, both earlier plans and this plan |
| Migrations | Generate with `npm run db:generate`; commit SQL, journal and snapshots together. Do not guess the next generated migration filename. |

## Execution Order

Execute Tasks 1-4 first. Tasks 5-9 depend on their final contracts and run sequentially in this plan. Task 10 integrates the complete lifecycle, and Task 11 is the delivery gate. Keep unrelated cleanup out of the patch.

For every code task: add one regression at a time, run the stated focused command and observe the intended failure, implement minimally, rerun green, then add the next case. The example assertions are required behavior, not a substitute for complete runnable test setup using the repo's existing fixtures and local bindings.

### Task 1: Establish Evidence And The Regression Matrix

**Files:** This plan; the two earlier plans; existing entitlement, subscription, reconciliation, cache, wiring and purge tests listed above.

**Interfaces:** Consumes the current implementation; produces an evidence ledger mapping R1-R12 to named regression tests and verification results.

- [x] Read `AGENTS.md`, the original plans, applicable rules and current callers. Run `git status --short` and preserve any existing work.
- [x] Run `npm run verify` before changes. Record actual totals and warnings; do not call warning-bearing output pristine.
- [x] Inventory existing tests with `rg -n 'it\(|it.each|test\(' app/domain/entitlement-policy.test.ts app/models/entitlements.test.ts app/services/entitlements.server.test.ts`. Separate observed coverage from missing assertions.
- [x] Use the Partner skill to verify `SubscriptionStatus.cancelEffectiveOn`, `ActiveSubscription`, `BillingCycle`, trials, cancellation/replacement, freeze/unfreeze and renewal event behavior for the configured API version. Also verify current auth/uninstall integration and Cloudflare KV expiration constraints before relying on them.
- [x] Record supported facts and explicit unknowns in `.claude/rules/shopify-api-invariants.md`. If an API cannot distinguish a required state, record the limitation and a fail-closed path; never manufacture status from the existence of an object alone.
- [x] Name each reproduction before changing behavior. A result that already passes is retained as a control; add the missing interleaving rather than weakening the test to create RED.

#### Task 1 evidence ledger (observed 2026-09-09)

**Baseline commands and outputs**

- `git status --short --branch` exited 0 and reported branch `fix/entitlements-review-remediation...origin/fix/entitlements-review-remediation` plus one pre-existing untracked file: `docs/superpowers/plans/2026-09-09-entitlements-remediation-execution.md`. No tracked changes were present before Task 1 evidence edits; the untracked execution plan was preserved.
- `npm run verify` exited 0. Typecheck and lint completed successfully. The Node test run reported `Test Files 137 passed (137)` and `Tests 1157 passed (1157)`, followed by the DOM test run reporting `Test Files 3 passed (3)` and `Tests 9 passed (9)`. The run emitted repeated warnings for missing `SHOPIFY_API_SECRET`, `SHOP_CUSTOM_DOMAIN`, and `ATTACHMENT_TOKEN_SECRET`, an AI remote-resource usage warning, the Vite `envFile` deprecation warning, and dependency sourcemap warnings. This output is green but not warning-free.
- The brief's expected `app/services/support.test.ts` rate-limit failure was not observed: `npx vitest run app/services/support.test.ts` exited 0 with `Test Files 1 passed (1)` and `Tests 31 passed (31)`. This is a baseline discrepancy, not evidence that the later remediation is unnecessary; preserve the existing assertion and re-check if it regresses.

**Existing entitlement test inventory**

The requested `rg` inventory found 96 test declarations across the named files: policy 18, entitlement models 26, subscription models 14, entitlement service 15, reconciliation service 4, cache 8, billing gates 3, reconciliation wiring 2, and tenant purge 6. These are pre-existing controls; none is counted as a newly observed RED reproduction in this task.

**R1–R12 coverage and missing regression matrix**

| Review risk | Existing observed controls | Missing or not newly reproduced in Task 1 |
|---|---|---|
| R1 cancellation history metadata | Subscription projection cancellation deadline and policy scheduled-cancellation boundary tests | HTTP-boundary history fixture proving date preservation and exact authoritative instant; live-store semantics |
| R2 KV preview authorizes work | Service cache-failure/fallback and authoritative-write tests; cache round-trip/isolation tests | Explicit cached ACTIVE versus current D1 CANCELED/FROZEN/disabled-grant gate test |
| R3 same-ID quota race | Model concurrent reservation/idempotent retry tests | Public service same-ID replay state contract across renewal/cancellation |
| R4 capacity confirmation result ignored | Reconciliation and capacity lifecycle controls exist | Caller-side create/confirm attempt identity and lost-response regression |
| R5 allocation crash leak | Held capacity listing/reconciliation controls | Ordinary caller crash window with explicit ownership decision and no age-only release |
| R6 timestamp-only revision ties | Numeric revision and stale-write tests | Same-timestamp different external IDs through both active/history writers |
| R7 fractional accounting | Service amount validation controls | Direct local-D1 fractional/unsafe insert rejection at schema boundary |
| R8 negative remaining | Advisory remaining policy tests | Deterministic concurrent limit-change interleaving proving fresh and replayed results are bounded |
| R9 terminal quota replay | Commit/release lifecycle and replay model controls | Public terminal replay state/replayed flag and no-side-effect consumer test |
| R10 multiple current projections | Latest authoritative subscription projection test | Seeded legacy multi-row migration and unique-current invariant |
| R11 stale active projection | Stale snapshot denial control in entitlement service | Refresh-on-stale integration with exact age boundaries, invalid/future verification, and failed refresh |
| R12 edge/clean-code coverage | Broad policy, cache, wiring, and purge controls | Full lifecycle matrix, Shopify HTTP fixtures, migration checks, docs examples, and live-store verification |

**Verified boundary facts and limitations**

- Configured app and Partner lookup version: `2026-07` (`shopify.app.toml`, `shopify.app.dev.toml`, and `app/shopify.server.ts`). The Partner toolkit validated an `activeSubscription` query against the `2026-07` schema.
- `SubscriptionStatus.cancelEffectiveOn` is a nullable `Date` (date-only), while `occurredAt` is `DateTime`; the status state enum includes `CANCELED`, `CANCELLATION_SCHEDULED`, `CREATED`, `FROZEN`, `UNFROZEN`, and `UPDATED`. Do not synthesize an exact instant from the date-only field.
- `activeSubscription(appId, shopId)` returns `null` when no active managed-pricing contract exists, and requires Partner Manage apps permission for public apps. Its documented shape exposes `billingPeriod`, `cancelAtEndOfCycle`, `trialEndsAt`, `currentBillingCycle`, items, and `pendingUpdate`; object existence alone is not a sufficient authorization state.
- `BillingCycle.startTime` and `endTime` are non-null `DateTime` fields; `endTime` is when the next charge occurs. `AppPricingInterval` documents `ANNUAL` and `EVERY_30_DAYS`, so a renewal boundary is not inherently a monthly quota boundary.
- `CancelledSubscription` documents that `cancelledAt` is null for deferred cancellations, `currentBillingCycle` is null while still in trial, `trialEndsAt` is null without an active trial, and `pendingUpdate` is null when absent. These nulls must remain distinct from an observed inactive/free state.
- `SubscriptionChargeFrozen` means a recurring app charge was suspended; `SubscriptionChargeUnfrozen` means it was unfrozen. The docs do not, by themselves, establish this app's exact authorization transition or refresh retry policy; local policy must fail closed for new work until authoritative state is verified.
- Renewal, replacement, and pending-update application order were not established by the retrieved reference pages or a live store. Do not claim those semantics are verified; use `activeSubscription.currentBillingCycle` and `pendingUpdate` from an authoritative refresh.
- Partner relationship events separately document installed, reactivated, and uninstalled events. The retrieved `Relationship` reference describes relationship state and reason fields, but does not establish this app's reinstall authorization fence or historical-job policy.
- Cloudflare KV `expirationTtl` is relative seconds with a 60-second minimum; absolute `expiration` also cannot be scheduled less than 60 seconds ahead. Missing keys read as `null`, and expiry makes subsequent reads act absent. The local test accepting a subminimum TTL is not evidence that production KV accepts it.
- Live Shopify cancellation, trial, freeze/unfreeze, renewal, replacement, uninstall/reinstall, and Partner outage behavior remain unverified by this local baseline. No live credentials or store calls were made.

Task 1 is evidence-complete only; no production behavior or regression test was changed. The detailed command log and source URLs are recorded in `task-1-report.md` for the execution run.

Sources already consulted in review, to recheck at execution:

- https://shopify.dev/docs/api/partner/2026-07/objects/SubscriptionStatus
- https://shopify.dev/docs/api/partner/2026-07/objects/BillingCycle
- https://shopify.dev/docs/api/partner/2026-07/active-subscription
- https://shopify.dev/docs/api/partner/2026-07/objects/CancelledSubscription

### Task 2: Repair Cancellation And Subscription Observation Metadata

**Files:** Shopify seam, refresh, projection and adjacent tests from the file map.

**Interfaces:** Preserve `cancelEffectiveOn: string | null` as date-only metadata through normalized history. Populate exact `cancellationEffectiveAt`, current period bounds and cleared fields only from verified semantics; unresolved metadata is not fabricated.

- [ ] Add an HTTP-boundary Shopify fixture delivering a scheduled cancellation with a future date; run history reconciliation into local D1 and assert that the date survives normalization and persistence.
- [ ] Add the full scenario with authoritative current-cycle bounds: access before the effective timestamp, denial exactly at it, and no early denial merely because cancellation was requested. Example policy assertions once the verified snapshot is obtained:

```ts
expect(resolveEntitlement(catalogue, snapshot, key, effectiveAt - 1).allowed).toBe(true);
expect(resolveEntitlement(catalogue, snapshot, key, effectiveAt)).toEqual({
  allowed: false, reason: "inactive_subscription",
});
```

- [ ] Run `npx vitest run app/services/reconcile-shopify-history.test.ts app/services/reconcile-subscription.test.ts app/models/shop-subscriptions.test.ts`; observe metadata loss or incorrect access before implementing.
- [ ] Carry the date through the real port/parser/service/model pipeline. Trigger an authoritative refresh when exact cancellation bounds are unresolved; history-only synchronization must not grant using guessed timestamps.
- [ ] Add RED/GREEN cases for cancellation during trial with no cycle, undoing scheduled cancellation, immediate cancellation, replacement/pending downgrade, malformed date data, duplicate history repair, stale history after a newer active read, freeze/unfreeze, and unavailable Partner API.
- [ ] Ensure a failed refresh cannot clear a known cancellation/freeze or replace it with `NONE`; a confirmed null active-subscription response follows the documented free/inactive policy and installation guard.
- [ ] Validate changed Shopify GraphQL using the toolkit, rerun focused tests, and commit the metadata fix with its tests and any generated migration.

### Task 3: Separate Authorization From Preview And Bound Freshness

**Files:** Policy, service, ports, KV, wiring/gates, `app/services/reconcile-subscription.ts`, and their tests.

**Interfaces:** `check(shop, key): Promise<CheckResult>` authorizes from D1; `preview(shop, key)` returns a display-only result with `authoritative: false`. Add `verifiedAt` to snapshots and inject `maxSnapshotAgeMs` plus a `refresh(shop)` port with a closed refreshed/failed result.

- [ ] Add local-KV/local-D1 regression coverage for cached ACTIVE versus current CANCELED/FROZEN/disabled-grant state. Exercise the real gate, not only a mock call count.

```ts
const gate = createPlanGate({ entitlements: service, key: "reports.export" });
expect(await gate.check(shop)).toEqual({ allowed: false, reason: "inactive_subscription" });
```

- [ ] Run `npx vitest run app/services/entitlements.server.test.ts app/adapters/entitlement-cache.server.test.ts app/billing/gates.test.ts`; observe the stale grant, then change `check` to use the authoritative path and give preview a separate contract.
- [ ] Add failing freshness cases at 299,999 and 300,000 milliseconds, future/invalid verification time, absent projection, confirmed NONE, failed refresh, and expired recorded billing window. Implement one refresh/reload attempt without recursive retry.
- [ ] Do not cache a stale projection again as if newly verified. Keep `cachedAt`, `verifiedAt` and revision distinct; bump the cache envelope version for changed snapshot fields and reject old envelopes.
- [ ] Test cache read/write/delete failure, real local KV hit/miss/isolation, malformed fields and expiry. Ensure the configured TTL is valid for actual KV, not merely a memory fake accepting an invalid short TTL.
- [ ] Keep new work fail-closed during refresh outages. Preserve settlement and release of existing operations. Add an explicit new denial reason instead of throwing an expected availability error.
- [ ] Document the five-minute template freshness budget independently of the daily production cron. Do not change cron cadence silently to imply a stronger guarantee.
- [ ] Run focused tests plus typecheck and commit the authorization/freshness boundary.

### Task 4: Make Current Projection Selection And Revision Unambiguous

**Files:** Subscription schema declarations, `app/models/shop-subscriptions.server.ts`, `app/models/shopify-events.server.ts`, tests, entitlement admission SQL, ports, cache and wiring.

**Interfaces:** One authoritative current projection per shop with `revision: number` and separate event cursor and `verifiedAt`. Both projection writers share the same ordering/revision semantics; new admissions compare that revision and require a present eligible projection.

- [ ] Reproduce ACTIVE event `a` then CANCELED event `b` at the same timestamp, with an entitlement snapshot read between them. Both stale quota reserve and capacity admission must deny after `b` applies.
- [ ] Run `npx vitest run app/models/shop-subscriptions.test.ts app/models/entitlements.test.ts app/services/reconcile-shopify-history.test.ts`; observe the unchanged-revision failure.
- [ ] Add a migration that deterministically selects the newest `(appliedOccurredAt, appliedExternalId, subscriptionId)` current row per shop, preserves the immutable event ledger, retains only its current item rows, and establishes a unique shop constraint for current projections.
- [ ] Add a dedicated revision column, initialized for retained rows. Advance it atomically for changed entitlement-relevant state, including same-timestamp later IDs and duplicate repairs that change granting fields. Guard integer overflow explicitly.
- [ ] Make both active-read and history writes target the same current shop projection and item replacement transaction. A stale event must neither replace the parent nor delete/replace its items. Remove read-order dependence from `currentForShop()`.
- [ ] Fence new entitlement writes against the exact revision, installation eligibility and an unexpired admission validity bound in the same SQL path. Remove the unconditional `NOT EXISTS(shop_subscriptions)` admission bypass.
- [ ] Add RED/GREEN tests for same-timestamp ties, concurrent active/history writes, duplicate no-op repair, fresher verifiedAt with unchanged revision, multiple legacy rows, absent projection, purge between read/write, and cancellation/period boundary crossed before admission.
- [ ] Verify an uninstall/reinstall cannot make an old authorization snapshot valid again through revision reset; use the existing installation lifecycle as a fence and retain revision through ordinary uninstall. Purge has no implicit free authorization.
- [ ] Apply migrations to both an empty local DB and seeded legacy multi-row data. Run full affected tests and typecheck, then commit schema, migration metadata and both writers together.

### Task 5: Enforce Integer Accounting At The Database Boundary

**Files:** `app/db/schema/entitlements.ts`, `app/db/schema/entitlements.test.ts`, generated migrations and `app/models/entitlements.test.ts`.

**Interfaces:** Persisted amounts satisfy integer storage, safe bounds and valid amount relationships, regardless of which adapter performs a write.

- [ ] Add direct local-D1 inserts/updates for fractional requested, reserved, actual, committed and held values. Each should fail a constraint rather than store a REAL value.

```ts
await expect(env.DB.prepare(
  "INSERT INTO entitlement_usage (shop,key,period,committed,held,updated_at) VALUES (?,?,?,?,?,?)",
).bind(shop, "documents.monthly", "2026-09", 1.5, 0, 0).run()).rejects.toThrow();
```

- [ ] Run `npx vitest run app/db/schema/entitlements.test.ts`; observe the accepted fractional insert before adding constraints.
- [ ] Add `typeof(column) = 'integer'`, non-negative and MAX_SAFE_INTEGER bounds for non-null accounting fields, allowing null only where the lifecycle requires it. Enforce `actual_amount <= reserved_amount` and safe total committed-plus-held usage.
- [ ] Generate a migration with `npm run db:generate`. Test clean migration and invalid legacy rows; invalid data must stop with an actionable error, never be silently rounded, dropped or truncated.
- [ ] Add boundary tests for zero, MAX_SAFE_INTEGER, MAX_SAFE_INTEGER + 1, negative numbers and fractional actual usage through the public service. Verify failed writes preserve previous aggregate and operation state.
- [ ] Run schema/model tests, inspect the SQL/journal/snapshot agreement, and commit the constraints and migration.

### Task 6: Make Quota Replays And Settlement Explicit

**Files:** `app/ports/entitlements.ts`, entitlement service/repository/tests, wiring and quota gates/tests.

**Interfaces:** State-bearing `ReserveResult`; shop-first persisted operation lookup; idempotent commit with actual amount conflict detection. Keep operation state immutable after terminal settlement.

- [ ] Add a committed replay and a released replay test through the public service. Assert returned state, replay flag and unchanged aggregates, not merely `allowed: true`.

```ts
expect(replayed).toMatchObject({ allowed: true, state: "committed", replayed: true });
expect(await service.commit({ shop, operationId, actualAmount: 1 }))
  .toMatchObject({ allowed: true, state: "committed" });
```

- [ ] Run `npx vitest run app/services/entitlements.server.test.ts app/models/entitlements.test.ts app/billing/gates.test.ts`; observe missing replay state and repeated-commit denial.
- [ ] Add operation lookup at the repository port and resolve existing identities before deriving new periods. New reservations still use fresh authorization and atomic quota/revision predicates; replay cannot create usage or authorize new side effects.
- [ ] Return original period/revision on matching public retry across month rollover, renewal, downgrade and cancellation. Reject altered key/amount. Preserve strict period/revision comparison for explicitly supplied repository requests.
- [ ] Make commit atomic and idempotent for identical actual usage, reject changed actual usage, and never transition released to committed. Make concurrent release/release return the same terminal outcome without duplicate accounting.
- [ ] Add RED/GREEN tests for concurrent same-ID reserve, differing requests sharing an ID, commit/commit, commit/release, release/release, zero actual usage, overage, changed revision, cross-shop settlement and aggregate rollback on failure.
- [ ] Add an example consumer test with an idempotent fake external HTTP provider: terminal replay does not call it; an unresolved held retry must consult ownership rather than repeat work unconditionally.
- [ ] Run focused tests/typecheck and commit the contract and lifecycle change.

### Task 7: Replace Automatic Capacity Promotion With Confirmed Attempts

**Files:** Capacity schema/migration, entitlement ports/service/repository, gates, wiring and adjacent tests.

**Interfaces:** `allocate`, `confirmAllocation`, and `deallocate` use `{ shop, key, allocationId, operationId }`; admission returns held state and confirmation settles the same attempt. Persistent operation identity is unique per shop and one active attempt is permitted per shop/key/resource.

- [ ] Add a concurrent identical-attempt test; both calls must succeed with the same held attempt and only one counted slot.

```ts
const outcomes = await Promise.all([service.allocate(input), service.allocate(input)]);
expect(outcomes.every((result) => result.allowed)).toBe(true);
expect(outcomes).toEqual(expect.arrayContaining([
  expect.objectContaining({ state: "held", allocationId, operationId }),
]));
```

- [ ] Run `npx vitest run app/models/entitlements.test.ts app/services/entitlements.server.test.ts`; observe duplicate denial and automatic promotion before implementing the new protocol.
- [ ] Migrate allocation rows to attempt-aware storage. Preserve existing state and stable resource identity with deterministic legacy attempt IDs; do not pretend existing allocated rows have newly verified ownership. Document how an adopter audits preexisting allocated rows.
- [ ] Implement atomic hold admission with current revision/validity and active-count checks. On an insert conflict, read and validate the winning attempt; a matching race is a replay, not exhaustion.
- [ ] Implement conditional confirmation and release that compare shop, key, resource, attempt ID and current state. Verify the affected row or replay state before returning success. Do not auto-promote in `allocate`.
- [ ] Add RED/GREEN tests for distinct-ID limit races, identical-ID races, changed resource/key identity, release before confirm, confirm before release, duplicate confirmation, and stale confirm/release after reactivation under a new operation ID.
- [ ] Verify same-resource reactivation after release under a newer subscription revision succeeds when current entitlement allows it; replay of the old released attempt remains released. Downgrade blocks new excessive capacity but never prevents cleanup of old attempts.
- [ ] Update the capacity gate and all callers/fixtures to carry operation identity. Delete the unsafe old auto-confirm path rather than retaining it as an overload.
- [ ] Run migration/model/service/gate tests and typecheck; commit the attempt protocol and migration.

### Task 8: Make Crash Recovery Match Real Caller Failure Windows

**Files:** `app/ports/entitlement-reconciliation.ts`, reconciliation service/tests, `app/wiring/entitlement-reconciliation.test.ts`, entitlement listing/apply methods.

**Interfaces:** Held items carry attempt identity and timestamps; quota items carry amount/period/revision. Decisions distinguish quota commit with actualAmount, quota release, capacity confirm, capacity release and ignore. Decision provider supports `Promise<HeldDecision>` for real ownership lookups.

- [ ] Add a capacity crash test: admission succeeds, caller resource creation is never confirmed, and `listHeld` returns that exact attempt. Add a second test where the resource exists but confirmation response was lost.
- [ ] Run `npx vitest run app/services/entitlement-reconciliation.server.test.ts app/wiring/entitlement-reconciliation.test.ts app/models/entitlements.test.ts`; observe the missing ordinary crash window or missing attempt identity.
- [ ] Implement typed explicit recovery through the same confirmation/commit/release transitions, including measured quota usage. A duplicate decision returns the actual terminal outcome; a contradictory decision reports conflict.
- [ ] Add RED/GREEN tests for provider timeout with unknown outcome (ignore/hold), known failure (release), known success (commit/confirm), reconciliation racing with live settlement, repeated decisions and cross-shop/old-attempt mismatch.
- [ ] List held items with deterministic keyset pagination rather than silently truncating or loading unlimited tenant history. Use an explicit `limit` and continuation cursor contract; test more than one page, concurrent removals and a resumable processing budget.
- [ ] Keep the trigger app-neutral: expose wiring and document cron/queue invocation, but do not install a reconciler that assumes every old hold is abandoned. Record failures for retry and expose remaining cursor when a run is partial.
- [ ] Run focused tests/typecheck and commit the recovery integration.

### Task 9: Bound Remaining Results And Period Admission

**Files:** `app/domain/entitlement-policy.ts`, policy tests, entitlement repository/service and tests.

**Interfaces:** A pure remaining-count calculation validates safe inputs and bounds output; every successful public result follows the same invariant. Concrete period windows are validated at new admission, not silently recomputed for replay.

- [ ] Add a controlled interleaving where an admission under maximum 1 is followed by an upgrade and another admission under maximum 2 before the first result is read. Assert every returned remaining is non-negative and a safe integer.

```ts
for (const result of results) {
  if (result.allowed) {
    expect(Number.isSafeInteger(result.remaining)).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  }
}
```

- [ ] Run `npx vitest run app/models/entitlements.test.ts app/domain/entitlement-policy.test.ts`; observe negative remaining on the existing fresh-success path. Use deterministic interleaving with real D1, not flaky timing sleeps.
- [ ] Use one bounded calculation for fresh and replayed quota/capacity results. Calculate against the admission revision/maximum and explicitly document the advisory nature of a post-write aggregate.
- [ ] Add RED/GREEN tests for concurrent downgrade below existing usage, unlimited grants, exact exhaustion, safe-integer boundaries and malformed repository results. Do not conceal corrupted accounting by clamping invalid stored values.
- [ ] Add policy cases for all statuses, unknown/prototype keys, unknown plans, malformed grants, invalid clock values, leap-year/UTC month boundaries, missing/reversed billing bounds and exact end boundary.
- [ ] Verify new admission cannot enter an expired period after a delayed service/repository handoff. Do not derive monthly windows from annual billing intervals. Settlement remains in its original recorded period.
- [ ] Run focused tests/typecheck and commit the result/window guardrails.

### Task 10: Verify Merchant Lifecycles, Purge And Adoption Contracts

**Files:** Projection/service/wiring integration tests, `app/models/tenant-purge.test.ts`, `app/services/tenant-purge.test.ts`, `docs/entitlements.md`, `docs/entitlements-template.md`.

**Interfaces:** Exercise the real composition root with local D1/KV and Shopify HTTP-boundary fixtures. No business resource table is added; example ownership is supplied at the outer application boundary.

- [ ] Add the missing rows in this matrix as failing integration tests, then implement only the identified missing behavior:

| Scenario | Required outcome |
| --- | --- |
| Merchant has not yet initialized billing | Unavailable/denied, not assumed free |
| Confirmed NONE on an installed shop | Explicit free grants and no paid leakage |
| Scheduled cancellation before/at/after boundary | Allowed before, denied at/after; exact metadata verified |
| Cancellation reversed before boundary | Cleared cancellation metadata; access follows fresh state |
| Immediate cancellation / frozen / unknown / pending | New work denied; existing holds can settle or release |
| Freeze then unfreeze | Fresh confirmed state restores eligible grants |
| Renewal or annual billing | Refresh valid cycle; no invented monthly billing period |
| Trial end with successful paid activation | Not falsely canceled at trial end |
| Downgrade below existing quota/capacity | No new excess work; no automatic resource deletion; cleanup allowed |
| Upgrade concurrent with old admission | Fenced admissions and bounded remaining |
| Uninstall with failed Partner refresh | Local eligibility denies; stale paid KV cannot authorize |
| Reinstall | Fresh initialization/installation fence; old jobs cannot authorize new work |
| Duplicate/out-of-order history or concurrent refresh | Deterministic current projection and stable no-op revision |
| D1/KV/Partner failure | No manufactured success; cache stays advisory; holds remain recoverable |
| Tenant purge and delayed operation | Every entitlement/attempt row removed; no absent-row admission bypass |
| Cross-shop same IDs | No read, mutation, replay or reconciliation leaks |

- [ ] Run `npx vitest run app/wiring app/models/tenant-purge.test.ts app/services/tenant-purge.test.ts app/services/reconcile-subscription.test.ts app/services/reconcile-shopify-history.test.ts app/models/entitlements.test.ts` after each integration fix.
- [ ] Extend tenant purge coverage for every new table/index-backed state and cache envelope key. Verify unrelated shops remain intact and invalidation failure is observable without claiming immediate global KV deletion consistency.
- [ ] Rewrite examples for authoritative capability check, display preview, capacity hold/create/confirm/release, and quota reserve/work/commit. Check every typed result; do not ignore commit failures or release a hold when the side effect's outcome is unknown.
- [ ] Add tested application-boundary examples for lifetime quota, UTC monthly quota, billing-period quota, and a reusable one-resource free capacity. Compile example helper fixtures against actual signatures; prose-only conceptual compilation is insufficient.
- [ ] Document launch choices: catalogue keys and grants, freshness budget, installed-shop auth, operation/resource identity, provider idempotency, measured usage, recovery trigger, error policy, migration deployment and over-limit resources.
- [ ] Audit unused legacy plan-handle entitlement helpers and competing catalogues with `rg -n 'canUsePlanFeature|entitlementFor|entitlementsFor|ENTITLEMENT_CATALOGUE' app docs`. Remove obsolete uncalled authorization seams and their obsolete-only tests; preserve unrelated display behavior and its tests.
- [ ] Reformat compressed affected code into named helpers and typed state transitions in a green-only refactor. Do not add new architecture ceremony beyond the named seams or perform unrelated repository cleanup.
- [ ] Run documentation example tests and affected suites, then commit integration, cleanup and handoff documentation.

### Task 11: Full Verification And Delivery Audit

**Files:** All touched implementation/tests/migrations, both earlier plans, and this plan.

**Interfaces:** Produces evidence-backed completion status, not an assertion of exhaustive real-world correctness.

- [ ] Run `npm run typecheck` and inspect complete output.
- [ ] Run `npm run lint`; inspect affected production files for casts, swallowed operational errors, boundary violations and oversized functions. A green linter alone does not prove the architectural contract.
- [ ] Run focused domain/service/D1/KV/reconciliation and Shopify projection suites, including every R1-R12 named regression.
- [ ] Run `npm test`, then `npm run verify`. Record observed totals and warnings without deleting checks to obtain green output.
- [ ] Verify generated migration journal/snapshots match SQL. Exercise empty install, seeded legacy migration, invalid legacy data rejection and tenant purge after migration.
- [ ] Run `git diff --check` and review the full diff. Verify no business-domain scope, undeclared bindings, UI changes, test skips or unrelated edits slipped in.
- [ ] Review the final code against each contract and matrix row. List any residual API semantics or live-store scenarios not verified; never mark them complete merely because local fixtures pass.
- [ ] Update the earlier plans with a link to this remediation and accurate supersession notes. Check tasks complete here only after their tests and implementation have actually been observed.
- [ ] Commit the final audit/documentation only after verification succeeds; report remaining limitations and the new public API compatibility changes.

## Acceptance Criteria

- R1-R12 each map to actual tests or an explicitly corrected review claim, with no silently dropped scope.
- KV can never authorize a capability, quota, or capacity operation. Stale authoritative state has a documented bounded refresh/failure policy.
- Scheduled cancellation metadata survives the Shopify pipeline; date-only and timestamp precision are not conflated.
- A single current shop projection and real revision fence distinguish same-timestamp changes, retries, uninstall and absent state.
- Concurrent quota/capacity requests never exceed their admitted limits; identical retries never become false exhaustion.
- Quota retries expose state and do not imply another side effect. Terminal settlement is idempotent only for the same requested outcome.
- Capacity has an externally meaningful held -> allocated -> released lifecycle with per-activation identity and recoverable crash windows.
- D1 rejects fractional/unsafe accounting. Public remaining counts are safe, non-negative and explicitly advisory.
- Billing renewal, cancellation, trial end and local snapshot staleness remain separate concepts.
- Cleanup, purge and recovery are tenant-isolated, idempotent and do not require an active paid plan to settle already-admitted work.
- The template remains configurable and app-neutral; no real merchant workflow is invented to demonstrate completion.
- All completion claims cite observed verification. Local tests do not masquerade as live Shopify lifecycle testing.
