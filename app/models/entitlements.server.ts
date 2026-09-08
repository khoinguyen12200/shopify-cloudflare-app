import { getDb, getEnv } from "~/request-context.server";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { entitlementAllocations, entitlementOperations, entitlementUsage, shopSubscriptions } from "~/db/schema";
import type { AllocateResult, DeallocateResult, ReserveResult, EntitlementOperationFailure } from "~/ports/entitlements";
import type { HeldItem, HeldDecision, ReconciliationResult } from "~/ports/entitlement-reconciliation";

async function d1Count(shop: string, key: string): Promise<number> {
  const [row] = await getDb().select({ count: count() }).from(entitlementAllocations).where(and(
    eq(entitlementAllocations.shop, shop),
    eq(entitlementAllocations.key, key),
    inArray(entitlementAllocations.state, ["held", "allocated"]),
  ));
  return Number(row?.count ?? 0);
}

async function usageRemaining(shop: string, key: string, period: string, maximum: number): Promise<number> {
  const [row] = await getDb().select({ committed: entitlementUsage.committed, held: entitlementUsage.held }).from(entitlementUsage).where(and(
    eq(entitlementUsage.shop, shop),
    eq(entitlementUsage.key, key),
    eq(entitlementUsage.period, period),
  )).limit(1);
  return Math.max(0, maximum - Number(row?.committed ?? 0) - Number(row?.held ?? 0));
}

export type OperationState = "held" | "committed" | "released";
export type AllocationState = "held" | "allocated" | "released";

function isOperationState(value: string): value is OperationState {
  return value === "held" || value === "committed" || value === "released";
}

/** D1 adapter for quota reservations and reusable concurrent allocations. */
export class EntitlementRepo {
  async applyReconciliation(shop: string, item: HeldItem, decision: Exclude<HeldDecision, "ignore">): Promise<ReconciliationResult> {
    if (shop !== item.shop) return { reason: "invalid_request" };
    if (item.kind === "capacity") {
      if (decision !== "allocate" && decision !== "deallocate") return { reason: "invalid_decision" };
      const state = decision === "allocate" ? "allocated" : "released";
      await getDb().update(entitlementAllocations).set({ state, updatedAt: Date.now() }).where(and(
        eq(entitlementAllocations.shop, shop),
        eq(entitlementAllocations.key, item.key),
        eq(entitlementAllocations.allocationId, item.id),
        eq(entitlementAllocations.state, "held"),
      ));
      const [row] = await getDb().select({ state: entitlementAllocations.state }).from(entitlementAllocations).where(and(
        eq(entitlementAllocations.shop, shop),
        eq(entitlementAllocations.key, item.key),
        eq(entitlementAllocations.allocationId, item.id),
      )).limit(1);
      if (!row) return { reason: "not_found" };
      return row.state === state ? { state } : { reason: "invalid_state" };
    }
    if (decision !== "commit" && decision !== "release") return { reason: "invalid_decision" };
    const [row] = await getDb().select({ state: entitlementOperations.state }).from(entitlementOperations).where(and(
      eq(entitlementOperations.shop, shop),
      eq(entitlementOperations.key, item.key),
      eq(entitlementOperations.operationId, item.id),
    )).limit(1);
    if (!row) return { reason: "not_found" };
    const target = decision === "commit" ? "committed" : "released";
    if (row.state === target) return { state: target };
    if (row.state !== "held") return { reason: "invalid_state" };
    const result = await this.reconcileHeld(shop, item.id, decision);
    if ("reason" in result) return result;
    return result.state === target ? { state: target } : { reason: "invalid_state" };
  }
  async listHeldAllocations(shop: string): Promise<readonly { key: string; allocationId: string }[]> {
    return getDb()
      .select({ key: entitlementAllocations.key, allocationId: entitlementAllocations.allocationId, operationId: entitlementAllocations.operationId })
      .from(entitlementAllocations)
      .where(and(eq(entitlementAllocations.shop, shop), eq(entitlementAllocations.state, "held")));
  }

  async listHeld(shop: string): Promise<readonly { operationId: string; key: string; period: string; amount: number }[]> {
    const rows = await getDb().select({ operationId: entitlementOperations.operationId, key: entitlementOperations.key, period: entitlementOperations.period, amount: entitlementOperations.reservedAmount }).from(entitlementOperations).where(and(eq(entitlementOperations.shop, shop), eq(entitlementOperations.state, "held")));
    return rows;
  }

  async reconcileHeld(shop: string, operationId: string, action: "commit" | "release"): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" }> {
    if (action === "commit") {
      const result = await this.commit({ shop, operationId });
      if ("reason" in result && result.reason === "invalid_amount") return { reason: "invalid_state" };
      if ("reason" in result) {
        if (result.reason === "not_found") return { reason: "not_found" };
        return { reason: "invalid_state" };
      }
      return result;
    }
    return this.release({ shop, operationId });
  }
  async allocate(input: { shop: string; key: string; allocationId: string; operationId: string; maximum: number; subscriptionRevision: number; now?: number }): Promise<AllocateResult> {
    const now = input.now ?? Date.now();
    const [existing] = await getDb().select({ key: entitlementAllocations.key, allocationId: entitlementAllocations.allocationId, subscriptionRevision: entitlementAllocations.subscriptionRevision, state: entitlementAllocations.state }).from(entitlementAllocations).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId))).limit(1);
    if (existing) {
      if (existing.key !== input.key || existing.allocationId !== input.allocationId) return { allowed: false, reason: "operation_conflict" };
      if (existing.subscriptionRevision !== input.subscriptionRevision) return { allowed: false, reason: "conflict" };
      if (existing.state !== "released") { const count = await d1Count(input.shop,input.key); return {allowed:true,allocationId:input.allocationId,operationId:input.operationId,subscriptionRevision:existing.subscriptionRevision,remaining:Math.max(0,input.maximum-count),state:"held"}; }
      return { allowed:false, reason:"invalid_state" };
    }
    const [active] = await getDb().select({ allocationId: entitlementAllocations.allocationId }).from(entitlementAllocations).where(and(
      eq(entitlementAllocations.shop, input.shop),
      eq(entitlementAllocations.key, input.key),
      eq(entitlementAllocations.allocationId, input.allocationId),
      inArray(entitlementAllocations.state, ["held", "allocated"]),
    )).limit(1);
    if (active) return { allowed:false, reason:"operation_conflict" };
    // Retain this guarded INSERT ... SELECT as a narrow SQL exception: Drizzle
    // cannot express admission based on a subscription row plus an aggregate
    // count while preserving single-statement capacity isolation.
    const d1 = getEnv().DB;
    const [held] = await d1.batch([d1.prepare("INSERT OR IGNORE INTO entitlement_allocations (shop,key,allocation_id,operation_id,subscription_revision,state,created_at,updated_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop=? AND revision=? AND status IN ('ACTIVE','CANCELLATION_SCHEDULED')) AND (SELECT count(*) FROM entitlement_allocations WHERE shop=? AND key=? AND state IN ('held','allocated')) < ?").bind(input.shop, input.key, input.allocationId, input.operationId, input.subscriptionRevision, "held", now, now, input.shop, input.subscriptionRevision, input.shop, input.key, input.maximum)]);
    if (held.meta.changes !== 1) {
      const [projection] = await getDb().select({ revision: shopSubscriptions.revision }).from(shopSubscriptions).where(eq(shopSubscriptions.shop, input.shop)).orderBy(desc(shopSubscriptions.appliedOccurredAt), desc(shopSubscriptions.appliedExternalId), desc(shopSubscriptions.subscriptionId)).limit(1);
      const [race] = await getDb().select({ key: entitlementAllocations.key, allocationId: entitlementAllocations.allocationId, subscriptionRevision: entitlementAllocations.subscriptionRevision, state: entitlementAllocations.state }).from(entitlementAllocations).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId))).limit(1);
      if (race) {
        if (race.key !== input.key || race.allocationId !== input.allocationId) return { allowed: false, reason: "operation_conflict" };
        if (race.subscriptionRevision !== input.subscriptionRevision) return { allowed: false, reason: "conflict" };
        return { allowed: true, allocationId: input.allocationId, operationId: input.operationId, subscriptionRevision: race.subscriptionRevision, remaining: Math.max(0, input.maximum - await d1Count(input.shop, input.key)), state: "held" };
      }
      return { allowed: false, reason: typeof projection?.revision === "number" && projection.revision !== input.subscriptionRevision ? "conflict" : "capacity_exhausted" };
    }
    const [allocationCount] = await getDb().select({ count: count() }).from(entitlementAllocations).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.key, input.key), inArray(entitlementAllocations.state, ["held", "allocated"])));
    return { allowed: true, allocationId: input.allocationId, operationId: input.operationId, subscriptionRevision: input.subscriptionRevision, remaining: input.maximum - Number(allocationCount?.count ?? 0), state: "held" };
  }

  async confirmAllocation(input: {shop:string; key:string; allocationId:string; operationId:string}): Promise<{allowed:true; allocationId:string; state:"allocated"}|EntitlementOperationFailure> {
    const db=getDb(); const [row] = await db.select().from(entitlementAllocations).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId))).limit(1);
    if(!row) return {allowed:false,reason:"not_found"}; if(row.operationId!==input.operationId) return {allowed:false,reason:"operation_conflict"}; if(row.state==="allocated") return {allowed:true,allocationId:input.allocationId,state:"allocated"}; if(row.state!=="held") return {allowed:false,reason:"invalid_state"};
    const updated = await db.update(entitlementAllocations).set({state:"allocated",updatedAt:Date.now()}).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId), eq(entitlementAllocations.state, "held"))).returning({state:entitlementAllocations.state});
    return updated.length ? {allowed:true,allocationId:input.allocationId,state:"allocated"} : {allowed:false,reason:"invalid_state"};
  }

  async deallocate(input: { shop: string; key: string; allocationId: string; operationId: string }): Promise<DeallocateResult> {
    const db = getDb();
    const released = await db.update(entitlementAllocations).set({ state: "released", updatedAt: Date.now() }).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.key, input.key), eq(entitlementAllocations.allocationId, input.allocationId), eq(entitlementAllocations.operationId, input.operationId), inArray(entitlementAllocations.state, ["held", "allocated"]))).returning({ allocationId: entitlementAllocations.allocationId });
    if (released.length > 0) return { allowed: true, allocationId: input.allocationId, operationId: input.operationId, state: "released" };
    const [row] = await db.select().from(entitlementAllocations).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId))).limit(1);
    if (!row) return { allowed: false, reason: "not_found" };
    if (row.state === "released" && row.key===input.key && row.allocationId===input.allocationId) return { allowed: true, allocationId: input.allocationId, operationId: input.operationId, state: "released" };
    return { allowed: false, reason: "invalid_state" };
  }
  async reserve(input: { shop: string; key: string; operationId: string; period: string; amount: number; maximum: number; subscriptionRevision: number; now?: number }): Promise<ReserveResult> {
    const now = input.now ?? Date.now();
    const db = getDb();
    const existing = await db.select().from(entitlementOperations).where(and(eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId))).limit(1);
    if (existing[0]) {
      const row = existing[0];
      return row.key === input.key && row.period === input.period && row.requestedAmount === input.amount && row.subscriptionRevision === input.subscriptionRevision && isOperationState(row.state)
        ? { allowed: true, operationId: input.operationId, amount: row.reservedAmount, period: row.period, subscriptionRevision: row.subscriptionRevision, state: row.state, replayed: true, remaining: await usageRemaining(input.shop, input.key, row.period, input.maximum) }
        : { allowed: false, reason: "operation_conflict" };
    }
    // The reservation batch intentionally uses SQLite's INSERT ... SELECT and
    // changes() guard so the operation row and held counter admit atomically.
    const d1 = getEnv().DB;
    const [, inserted, updated] = await d1.batch([
      d1.prepare("INSERT OR IGNORE INTO entitlement_usage (shop, key, period, committed, held, updated_at) VALUES (?, ?, ?, 0, 0, ?)").bind(input.shop, input.key, input.period, now),
      d1.prepare("INSERT OR IGNORE INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, NULL, ?, 'held', ?, ? WHERE EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop=? AND revision=? AND status IN ('ACTIVE','CANCELLATION_SCHEDULED')) AND EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND committed + held + ? <= ?)").bind(input.shop, input.operationId, input.key, input.period, input.amount, input.amount, input.subscriptionRevision, now, now, input.shop, input.subscriptionRevision, input.shop, input.key, input.period, input.amount, input.maximum),
      d1.prepare("UPDATE entitlement_usage SET held = held + ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND changes() = 1").bind(input.amount, now, input.shop, input.key, input.period),
    ]);
    if (inserted.meta.changes !== 1 || updated.meta.changes !== 1) {
      const [raced] = await db.select().from(entitlementOperations).where(and(eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId))).limit(1);
      if (!raced) {
        const [projection] = await getDb().select({ revision: shopSubscriptions.revision }).from(shopSubscriptions).where(eq(shopSubscriptions.shop, input.shop)).orderBy(desc(shopSubscriptions.appliedOccurredAt), desc(shopSubscriptions.appliedExternalId), desc(shopSubscriptions.subscriptionId)).limit(1);
        return { allowed: false, reason: typeof projection?.revision === "number" && projection.revision !== input.subscriptionRevision ? "operation_conflict" : "quota_exhausted" };
      }
      return raced.key === input.key && raced.period === input.period && raced.requestedAmount === input.amount && raced.subscriptionRevision === input.subscriptionRevision && isOperationState(raced.state)
        ? { allowed: true, operationId: input.operationId, amount: raced.reservedAmount, period: raced.period, subscriptionRevision: raced.subscriptionRevision, state: raced.state, replayed: true, remaining: await usageRemaining(input.shop, input.key, raced.period, input.maximum) }
        : { allowed: false, reason: "operation_conflict" };
    }
    const [aggregate] = await db.select({ committed: entitlementUsage.committed, held: entitlementUsage.held }).from(entitlementUsage).where(and(eq(entitlementUsage.shop, input.shop), eq(entitlementUsage.key, input.key), eq(entitlementUsage.period, input.period))).limit(1);
    return { allowed: true, operationId: input.operationId, amount: input.amount, period: input.period, subscriptionRevision: input.subscriptionRevision, state: "held", replayed: false, remaining: Math.max(0, input.maximum - Number(aggregate?.committed ?? 0) - Number(aggregate?.held ?? 0)) };
  }

  async commit(input: { shop: string; operationId: string; actualAmount?: number; now?: number }): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" | "invalid_amount" }> {
    const [row] = await getDb().select().from(entitlementOperations).where(and(eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId))).limit(1);
    if (!row) return { reason: "not_found" };
    if (row.state === "committed") {
      const expected = row.actualAmount ?? row.reservedAmount;
      return input.actualAmount !== undefined && input.actualAmount !== expected ? { reason: "invalid_amount" } : { state: "committed" };
    }
    if (row.state === "released") return { reason: "invalid_state" };
    const actual = input.actualAmount ?? row.reservedAmount;
    if (actual < 0 || actual > row.reservedAmount) return { reason: "invalid_amount" };
    const now = input.now ?? Date.now();
    // Commit/release remain a guarded two-statement D1 batch. The second update
    // is contingent on changes() from the first, preventing double transitions.
    const d1 = getEnv().DB;
    const [operationUpdate, usageUpdate] = await d1.batch([
      d1.prepare("UPDATE entitlement_operations SET state = 'committed', actual_amount = ?, updated_at = ? WHERE shop = ? AND operation_id = ? AND state = 'held' AND EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND held >= ?)").bind(actual, now, input.shop, input.operationId, input.shop, row.key, row.period, row.reservedAmount),
      d1.prepare("UPDATE entitlement_usage SET held = held - ?, committed = committed + ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND held >= ? AND changes() = 1").bind(row.reservedAmount, actual, now, input.shop, row.key, row.period, row.reservedAmount),
    ]);
    return operationUpdate.meta.changes === 1 && usageUpdate.meta.changes === 1 ? { state: "committed" } : { reason: "invalid_state" };
  }

  async release(input: { shop: string; operationId: string; now?: number }): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" }> {
    const [row] = await getDb().select().from(entitlementOperations).where(and(eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId))).limit(1);
    if (!row) return { reason: "not_found" };
    if (row.state !== "held" && isOperationState(row.state)) return { state: row.state };
    const now = input.now ?? Date.now();
    // Release uses the same atomic changes()-guarded batch as commit, ensuring
    // held usage is decremented at most once under retries.
    const d1 = getEnv().DB;
    const [operationUpdate, usageUpdate] = await d1.batch([
      d1.prepare("UPDATE entitlement_operations SET state = 'released', updated_at = ? WHERE shop = ? AND operation_id = ? AND state = 'held' AND EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND held >= ?)").bind(now, input.shop, input.operationId, input.shop, row.key, row.period, row.reservedAmount),
      d1.prepare("UPDATE entitlement_usage SET held = held - ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND held >= ? AND changes() = 1").bind(row.reservedAmount, now, input.shop, row.key, row.period, row.reservedAmount),
    ]);
    return operationUpdate.meta.changes === 1 && usageUpdate.meta.changes === 1 ? { state: "released" } : { reason: "invalid_state" };
  }
}
