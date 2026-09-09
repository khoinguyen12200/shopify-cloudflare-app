# Entitlements

The entitlement subsystem is the reusable boundary between app features and billing. Feature code asks for a stable key and never compares Shopify plan handles.

## Choose the right kind

- **Capability** is on or off. Use `check(shop, "feature.key")` before exposing or running it.
- **Capacity** limits concurrently active resources. Free can allow one active staff member forever: allocate its stable resource ID before activation, then deallocate that ID on deletion/deactivation so the slot is reusable.
- **Quota** consumes units. `lifetime` never resets, `calendar_month` resets at UTC month boundaries, and `billing_period` uses recorded subscription bounds.

Keep definitions and per-plan grants in the catalogue. Do not add app-specific resource tables or flows to the entitlement subsystem.

## Capability

```ts
const decision = await entitlements().check(shop, "reports.export");
if (!decision.allowed) return denied(decision.reason);
```

## Reusable capacity

```ts
const operationId = crypto.randomUUID();
const held = await entitlements().allocate({
  shop,
  key: "staff.max",
  allocationId: staffUserId,
  operationId,
});
if (!held.allowed) return held;

// Create or activate the resource, then confirm the held attempt.
const allocated = await entitlements().confirmAllocation({ shop, key: "staff.max", allocationId: staffUserId, operationId });
if (!allocated.allowed) return allocated;

// If creation fails, release the held attempt; after activation, deallocate it when removed.
await entitlements().deallocate({ shop, key: "staff.max", allocationId: staffUserId, operationId });
```

Always use a stable resource ID. Duplicate allocation/deallocation is idempotent. A released allocation no longer counts, so a one-staff Free limit works indefinitely rather than being consumed forever.

## Consumable quota

```ts
const reservation = await entitlements().reserve({
  shop,
  key: "documents.monthly",
  operationId: requestId,
  amount: 1,
});
if (!reservation.allowed) return reservation;

try {
  await performWork();
  await entitlements().commit({ shop, operationId: requestId, actualAmount: 1 });
} catch (error) {
  await entitlements().release({ shop, operationId: requestId });
  throw error;
}
```

Use a caller-supplied idempotency key that is stable across retries. Reserve before side effects, commit after success, and release on failure.

## Crash reconciliation

A crash can leave quota reservations or capacity allocations in `held`. They never expire silently. A scheduled reconciler must list held records, inspect the owning operation/resource, then explicitly commit/allocate or release/deallocate. Reconciliation uses the same idempotent public operations.

## Cache and invalidation

KV is advisory and only accelerates display checks. Quota reservations and capacity allocations always use authoritative D1 subscription state. Invalidate `entitlements:v1:${shop}` after every successful subscription projection write, duplicate repair, uninstall, and tenant purge. Malformed, stale, or unavailable KV entries are cache misses.

## Internal AI

The template's current AI is an internal admin/staff tool and is intentionally not entitlement-gated. A future merchant-facing AI flow should use quota reserve/commit/release exactly like any other consumable operation.
