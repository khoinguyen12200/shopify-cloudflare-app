# Reusable Entitlements Implementation Plan

Goal: feature code names a feature and quantity; the base owns subscription lookup,
periods, concurrency, retry identity, cache boundaries and reservation lifecycle.

## Reviewed Design

- Define capability, capacity and quota features in a typed registry; plans hold
  grants. The engine accepts a catalogue so new apps do not edit engine branches.
- Resolve subscription state from D1. Missing/unknown observations fail closed;
  explicit NONE/CANCELED use free. Scheduled cancellation has an effective bound.
- Derive UTC month, lifetime or recorded billing period on the server. Missing
  billing bounds deny; annual billing must never silently become monthly.
- Use a D1 reservation ledger with shop/feature/operation identity and one
  conditional INSERT SELECT. Sum held/committed usage in that statement and
  compare the subscription revision in the same write. Retries return the same
  reservation; changed arguments conflict. Commit can reduce a reservation;
  release frees it. Neither transition can resurrect a released operation.
- Keep quantities exact safe integers. Unlimited still records usage. Capability
  checks never call consumption. A capacity slot stays held until released.
- KV caches display previews only, with bounded application freshness, schema
  validation and catalogue version. Authoritative checks and reservations use D1.
  A preview is advisory and cannot grant execution. Cache failures log and fall
  back to D1. Subscription writers invalidate the shop preview.
- Wire adapters in wiring.server.ts. Provide an AI gate adapter; staff/system
  remain independent of merchant subscriptions. No external Shopify API changes.
- Include tenant purge coverage for the ledger and cache, usage examples and
  explicit failure/crash recovery responsibilities. No auto-expiry that could
  release still-running work and allow overspend.

## Execution

- [ ] Pure registry, grant/status/period/amount and lifecycle tests, observed red,
  then implementation in app/domain and app/billing.
- [ ] Port and service tests, observed red; implement check/reserve/commit/release
  without framework, DB or Cloudflare imports.
- [ ] Real local D1 tests for boundary/concurrency/replay/isolation/revision races;
  implement schema and adapter and generate forward migrations.
- [ ] Real local KV tests for miss/staleness/corruption/invalidation/isolation;
  implement preview adapter and wire subscription invalidation.
- [ ] Test reusable AI gate integration, tenant purge, and document usage.
- [ ] Run full verify, review with reviewer, fix findings and report evidence.
