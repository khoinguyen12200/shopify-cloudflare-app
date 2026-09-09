import { resolveEntitlement, type EntitlementCatalogue, type EntitlementKey } from "~/domain/entitlement-policy";
import type { AllocateResult, CapacityPort, CheckResult, CommitResult, DeallocateResult, EntitlementCachePort, EntitlementOperationFailure, PreviewResult, ReleaseResult, ReserveResult, SubscriptionPort, UsagePort } from "~/ports/entitlements";
interface Dependencies { readonly subscriptions: SubscriptionPort; readonly catalogue: EntitlementCatalogue; readonly capacity?: CapacityPort; readonly usage?: UsagePort; readonly cache?: EntitlementCachePort; readonly now?: () => number; readonly maxSnapshotAgeMs?: number; }
interface AllocationInput { readonly shop: string; readonly key: EntitlementKey; readonly allocationId: string; readonly operationId: string; }
interface ReserveInput { readonly shop: string; readonly key: EntitlementKey; readonly operationId: string; readonly amount: number; }
export interface EntitlementService {
  check(shop: string, key: EntitlementKey): Promise<CheckResult>;
  preview(shop: string, key: EntitlementKey): Promise<PreviewResult>;
  allocate(input: AllocationInput): Promise<AllocateResult>;
  deallocate(input: AllocationInput): Promise<DeallocateResult>;
  confirmAllocation(input: AllocationInput): Promise<{allowed:true;allocationId:string;state:"allocated"}|EntitlementOperationFailure>;
  reserve(input: ReserveInput): Promise<ReserveResult>;
  commit(input: { readonly shop: string; readonly operationId: string; readonly actualAmount?: number }): Promise<CommitResult>;
  release(input: { readonly shop: string; readonly operationId: string }): Promise<ReleaseResult>;
  invalidate(shop: string): Promise<void>;
}
const invalidRequest: EntitlementOperationFailure = { allowed: false, reason: "invalid_request" };
const valid = (value: string) => value.trim().length > 0;
const capacityPort = (port: CapacityPort | undefined): CapacityPort => { if (!port) throw new Error("capacity port unavailable"); return port; };
const usagePort = (port: UsagePort | undefined): UsagePort => { if (!port) throw new Error("usage port unavailable"); return port; };
async function existingQuota(deps: Dependencies, input: ReserveInput) {
  if (!deps.usage?.find) return undefined;
  return deps.usage.find(input.shop, input.operationId);
}

async function authoritative(deps: Dependencies, shop: string) {
  let snapshot = await deps.subscriptions.current(shop);
  const now = deps.now ?? Date.now;
  const maxAge = deps.maxSnapshotAgeMs ?? 300_000;
  const stale = snapshot.verifiedAt !== undefined && (snapshot.verifiedAt > now() || now() - snapshot.verifiedAt > maxAge);
  if (stale) {
    if (!deps.subscriptions.refresh) return { status: "UNKNOWN" as const, planHandle: null, revision: snapshot.revision, verifiedAt: snapshot.verifiedAt };
    try {
      snapshot = await deps.subscriptions.refresh(shop);
    } catch (error) {
      console.error(JSON.stringify({ event: "entitlements.subscription_refresh_failed", shop, error: error instanceof Error ? error.message : "unknown" }));
      return { status: "UNKNOWN" as const, planHandle: null, revision: snapshot.revision, verifiedAt: snapshot.verifiedAt };
    }
  }
  if (deps.cache) {
    try {
      await deps.cache.set(shop, snapshot, 60);
    } catch {
      // Cache is advisory; authoritative subscription data still wins.
    }
  }
  return snapshot;
}

async function preview(deps: Dependencies, shop: string) {
  if (deps.cache) {
    try {
      const snapshot = await deps.cache.get(shop);
      if (snapshot) return snapshot;
    } catch {
      // Cache is advisory; fall through to the subscription projection.
    }
  }
  return authoritative(deps, shop);
}
function makeCheck(deps: Dependencies, now: () => number) {
  return async (shop: string, key: EntitlementKey): Promise<CheckResult> => {
    if (!valid(shop) || !valid(key)) return invalidRequest;
    const snapshot = await authoritative(deps, shop);
    const age = snapshot.verifiedAt === undefined ? 0 : now() - snapshot.verifiedAt;
    if (snapshot.verifiedAt !== undefined && (snapshot.verifiedAt > now() || age > (deps.maxSnapshotAgeMs ?? 300_000))) return { allowed: false, reason: "subscription_unavailable" };
    return resolveEntitlement(deps.catalogue, snapshot, key, now());
  };
}
function makePreview(deps: Dependencies, now: () => number) {
  return async (shop: string, key: EntitlementKey): Promise<PreviewResult> => {
    if (!valid(shop) || !valid(key)) return { ...invalidRequest, authoritative: false };
    const result = resolveEntitlement(deps.catalogue, await preview(deps, shop), key, now());
    return Object.assign(result, { authoritative: false as const });
  };
}
function makeAllocate(deps: Dependencies, now: () => number) {
  return async (input: AllocationInput): Promise<AllocateResult> => {
    const port = capacityPort(deps.capacity);
    if (!valid(input.shop) || !valid(input.key) || !valid(input.allocationId) || !valid(input.operationId)) return invalidRequest;
    const snapshot = await authoritative(deps, input.shop);
    const resolved = resolveEntitlement(deps.catalogue, snapshot, input.key, now());
    if (!resolved.allowed) return resolved;
    if (resolved.kind !== "capacity") return invalidRequest;
    return port.allocate({ ...input, maximum: resolved.maximum ?? Number.MAX_SAFE_INTEGER, subscriptionRevision: snapshot.revision });
  };
}
function makeReserve(deps: Dependencies, now: () => number) {
  return async (input: ReserveInput): Promise<ReserveResult> => {
    const port = usagePort(deps.usage);
    if (!valid(input.shop) || !valid(input.key) || !valid(input.operationId) || !Number.isSafeInteger(input.amount) || input.amount <= 0) return invalidRequest;
    const existing = await existingQuota(deps, input);
    if (existing) {
      if (existing.key !== input.key || existing.amount !== input.amount) return { allowed: false, reason: "operation_conflict" };
      return { allowed: true, operationId: input.operationId, amount: existing.amount, period: existing.period, subscriptionRevision: existing.subscriptionRevision, state: existing.state, replayed: true, remaining: 0 };
    }
    const snapshot = await authoritative(deps, input.shop);
    const resolved = resolveEntitlement(deps.catalogue, snapshot, input.key, now());
    if (!resolved.allowed) return resolved;
    if (resolved.kind !== "quota") return invalidRequest;
    return port.reserve({ ...input, maximum: resolved.maximum ?? Number.MAX_SAFE_INTEGER, period: resolved.window.key, periodStart: resolved.window.kind === "lifetime" ? undefined : resolved.window.start, periodEnd: resolved.window.kind === "lifetime" ? undefined : resolved.window.end, subscriptionRevision: snapshot.revision });
  };
}
export function createEntitlements(deps: Dependencies): EntitlementService { const now = deps.now ?? Date.now; return {
  check: makeCheck(deps, now), preview: makePreview(deps, now), allocate: makeAllocate(deps, now), reserve: makeReserve(deps, now),
  async confirmAllocation(input) { const port = capacityPort(deps.capacity); if (!valid(input.shop) || !valid(input.key) || !valid(input.allocationId) || !valid(input.operationId)) return invalidRequest; return port.confirmAllocation(input); },
  async deallocate(input) { const port = capacityPort(deps.capacity); if (!valid(input.shop) || !valid(input.key) || !valid(input.allocationId) || !valid(input.operationId)) return invalidRequest; return port.deallocate(input); },
  async commit(input) { const port = usagePort(deps.usage); if (!valid(input.shop) || !valid(input.operationId) || (input.actualAmount !== undefined && (!Number.isSafeInteger(input.actualAmount) || input.actualAmount < 0))) return invalidRequest; return port.commit(input); },
  async release(input) { const port = usagePort(deps.usage); if (!valid(input.shop) || !valid(input.operationId)) return invalidRequest; return port.release(input); },
  async invalidate(shop) {
    if (!deps.cache || !valid(shop)) return;
    try {
      await deps.cache.invalidate(shop);
    } catch (error) {
      console.error(JSON.stringify({
        event: "entitlements.cache_invalidation_failed",
        shop,
        error: error instanceof Error ? error.message : "unknown",
      }));
    }
  },
}; }
