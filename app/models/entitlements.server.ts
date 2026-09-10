import { getDb } from "~/request-context.server";
import { and, count, desc, eq, inArray, exists, lt, lte, gte, sql } from "drizzle-orm";
import { entitlementAllocations, entitlementOperations, entitlementUsage, shopSubscriptions } from "~/db/schema";
import type { AllocateResult, DeallocateResult, ReserveResult, EntitlementOperationFailure } from "~/ports/entitlements";
import type { HeldItem, ReconciliationResult } from "~/ports/entitlement-reconciliation";

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
  async findOperation(shop: string, operationId: string) {
    const [row] = await getDb().select({ key: entitlementOperations.key, requestedAmount: entitlementOperations.requestedAmount, period: entitlementOperations.period, subscriptionRevision: entitlementOperations.subscriptionRevision, state: entitlementOperations.state }).from(entitlementOperations).where(and(eq(entitlementOperations.shop, shop), eq(entitlementOperations.operationId, operationId))).limit(1);
    return row && isOperationState(row.state) ? row : undefined;
  }

  async applyReconciliation(shop: string, item: HeldItem, decision: "commit" | "release" | "confirm", actualAmount?: number): Promise<ReconciliationResult> {
    if (shop !== item.shop) return { reason: "invalid_request" };
    if (item.kind === "capacity") {
      if (decision !== "confirm" && decision !== "release") return { reason: "invalid_decision" };
      const state = decision === "confirm" ? "allocated" : "released";
      await getDb().update(entitlementAllocations).set({ state, updatedAt: Date.now() }).where(and(
        eq(entitlementAllocations.shop, shop),
        eq(entitlementAllocations.key, item.key),
        eq(entitlementAllocations.allocationId, item.id),
        ...(item.operationId ? [eq(entitlementAllocations.operationId, item.operationId)] : []),
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
    const result = await this.reconcileHeld(shop, item.id, decision, actualAmount);
    if ("reason" in result) return result;
    return result.state === target ? { state: target } : { reason: "invalid_state" };
  }
  async listHeldAllocations(shop: string): Promise<readonly { key: string; allocationId: string; operationId: string; createdAt: number }[]> {
    return getDb()
      .select({ key: entitlementAllocations.key, allocationId: entitlementAllocations.allocationId, operationId: entitlementAllocations.operationId, createdAt: entitlementAllocations.createdAt })
      .from(entitlementAllocations)
      .where(and(eq(entitlementAllocations.shop, shop), eq(entitlementAllocations.state, "held")));
  }

  async listHeld(shop: string): Promise<readonly { operationId: string; key: string; period: string; amount: number; createdAt: number }[]> {
    const rows = await getDb().select({ operationId: entitlementOperations.operationId, key: entitlementOperations.key, period: entitlementOperations.period, amount: entitlementOperations.reservedAmount, createdAt: entitlementOperations.createdAt }).from(entitlementOperations).where(and(eq(entitlementOperations.shop, shop), eq(entitlementOperations.state, "held")));
    return rows;
  }

  async reconcileHeld(shop: string, operationId: string, action: "commit" | "release", actualAmount?: number): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" }> {
    if (action === "commit") {
      const result = await this.commit({ shop, operationId, actualAmount });
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
      if (existing.state !== "released") { const count = await d1Count(input.shop,input.key); return {allowed:true,allocationId:input.allocationId,operationId:input.operationId,subscriptionRevision:existing.subscriptionRevision,remaining:Math.max(0,input.maximum-count),state: existing.state === "allocated" ? "allocated" : "held"}; }
      return { allowed:false, reason:"invalid_state" };
    }
    const [active] = await getDb().select({ allocationId: entitlementAllocations.allocationId }).from(entitlementAllocations).where(and(
      eq(entitlementAllocations.shop, input.shop),
      eq(entitlementAllocations.key, input.key),
      eq(entitlementAllocations.allocationId, input.allocationId),
      inArray(entitlementAllocations.state, ["held", "allocated"]),
    )).limit(1);
    if (active) return { allowed:false, reason:"operation_conflict" };
    const db = getDb();
    const capacity = db.select({ value: count() }).from(entitlementAllocations).where(and(
      eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.key, input.key),
      inArray(entitlementAllocations.state, ["held", "allocated"]),
    ));
    const held = await db.insert(entitlementAllocations).select(db.select({
      shop: sql<string>`${input.shop}`.as("shop"), key: sql<string>`${input.key}`.as("key"),
      allocationId: sql<string>`${input.allocationId}`.as("allocation_id"),
      operationId: sql<string>`${input.operationId}`.as("operation_id"),
      subscriptionRevision: sql<number>`${input.subscriptionRevision}`.as("subscription_revision"),
      state: sql<string>`${"held"}`.as("state"), createdAt: sql<number>`${now}`.as("created_at"), updatedAt: sql<number>`${now}`.as("updated_at"),
    }).from(shopSubscriptions).where(and(
      eq(shopSubscriptions.shop, input.shop), eq(shopSubscriptions.revision, input.subscriptionRevision),
      inArray(shopSubscriptions.status, ["NONE", "ACTIVE", "CANCELLATION_SCHEDULED"]), lt(capacity, input.maximum),
    )).limit(1)).onConflictDoNothing();
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
    return { allowed: true, allocationId: input.allocationId, operationId: input.operationId, subscriptionRevision: input.subscriptionRevision, remaining: Math.max(0, input.maximum - Number(allocationCount?.count ?? 0)), state: "held" };
  }

  async confirmAllocation(input: {shop:string; key:string; allocationId:string; operationId:string}): Promise<{allowed:true; allocationId:string; state:"allocated"}|EntitlementOperationFailure> {
    const db=getDb(); const [row] = await db.select().from(entitlementAllocations).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId))).limit(1);
    if(!row) return {allowed:false,reason:"not_found"}; if(row.key !== input.key || row.allocationId !== input.allocationId) return {allowed:false,reason:"operation_conflict"}; if(row.state==="allocated") return {allowed:true,allocationId:row.allocationId,state:"allocated"}; if(row.state!=="held") return {allowed:false,reason:"invalid_state"};
    const updated = await db.update(entitlementAllocations).set({state:"allocated",updatedAt:Date.now()}).where(and(eq(entitlementAllocations.shop, input.shop), eq(entitlementAllocations.operationId, input.operationId), eq(entitlementAllocations.state, "held"))).returning({state:entitlementAllocations.state});
    return updated.length ? {allowed:true,allocationId:row.allocationId,state:"allocated"} : {allowed:false,reason:"invalid_state"};
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
    const usageScope = and(eq(entitlementUsage.shop, input.shop), eq(entitlementUsage.key, input.key), eq(entitlementUsage.period, input.period));
    const [, inserted, updated] = await db.batch([
      db.insert(entitlementUsage).values({ shop: input.shop, key: input.key, period: input.period, committed: 0, held: 0, updatedAt: now }).onConflictDoNothing(),
      db.insert(entitlementOperations).select(db.select({
        shop: sql<string>`${input.shop}`.as("shop"), operationId: sql<string>`${input.operationId}`.as("operation_id"),
        key: sql<string>`${input.key}`.as("key"), period: sql<string>`${input.period}`.as("period"),
        requestedAmount: sql<number>`${input.amount}`.as("requested_amount"), reservedAmount: sql<number>`${input.amount}`.as("reserved_amount"),
        actualAmount: sql<null>`${null}`.as("actual_amount"), subscriptionRevision: sql<number>`${input.subscriptionRevision}`.as("subscription_revision"),
        state: sql<string>`${"held"}`.as("state"), createdAt: sql<number>`${now}`.as("created_at"), updatedAt: sql<number>`${now}`.as("updated_at"),
      }).from(entitlementUsage).where(and(usageScope,
        lte(sql`${entitlementUsage.committed} + ${entitlementUsage.held} + ${input.amount}`, input.maximum),
        exists(db.select({ shop: shopSubscriptions.shop }).from(shopSubscriptions).where(and(eq(shopSubscriptions.shop, input.shop), eq(shopSubscriptions.revision, input.subscriptionRevision), inArray(shopSubscriptions.status, ["ACTIVE", "CANCELLATION_SCHEDULED"])))),
      ))).onConflictDoNothing(),
      // The dependent update stays inside the atomic batch for replay safety.
      db.update(entitlementUsage).set({ held: sql`${entitlementUsage.held} + ${input.amount}`, updatedAt: now }).where(and(usageScope, eq(sql<number>`changes()`, 1))),
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

  async commit(input: { shop: string; operationId: string; actualAmount?: number; now?: number }): Promise<{ state: OperationState; replayed?: boolean } | { reason: "not_found" | "invalid_state" | "invalid_amount" }> {
    const [row] = await getDb().select().from(entitlementOperations).where(and(eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId))).limit(1);
    if (!row) return { reason: "not_found" };
    if (row.state === "committed") {
      const expected = row.actualAmount ?? row.reservedAmount;
      return input.actualAmount !== undefined && input.actualAmount !== expected ? { reason: "invalid_amount" } : { state: "committed", replayed: true };
    }
    if (row.state === "released") return { reason: "invalid_state" };
    const actual = input.actualAmount ?? row.reservedAmount;
    if (actual < 0 || actual > row.reservedAmount) return { reason: "invalid_amount" };
    const now = input.now ?? Date.now();
    const db = getDb();
    const usageScope = and(eq(entitlementUsage.shop, input.shop), eq(entitlementUsage.key, row.key), eq(entitlementUsage.period, row.period), gte(entitlementUsage.held, row.reservedAmount));
    const [operationUpdate, usageUpdate] = await db.batch([
      db.update(entitlementOperations).set({ state: "committed", updatedAt: now, actualAmount: actual }).where(and(
        eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId), eq(entitlementOperations.state, "held"),
        exists(db.select({ shop: entitlementUsage.shop }).from(entitlementUsage).where(usageScope)),
      )),
      db.update(entitlementUsage).set({ held: sql`${entitlementUsage.held} - ${row.reservedAmount}`, committed: sql`${entitlementUsage.committed} + ${actual}`, updatedAt: now }).where(and(usageScope, eq(sql<number>`changes()`, 1))),
    ]);
    return operationUpdate.meta.changes === 1 && usageUpdate.meta.changes === 1 ? { state: "committed" } : { reason: "invalid_state" };
  }

  async release(input: { shop: string; operationId: string; now?: number }): Promise<{ state: OperationState; replayed?: boolean } | { reason: "not_found" | "invalid_state" }> {
    const [row] = await getDb().select().from(entitlementOperations).where(and(eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId))).limit(1);
    if (!row) return { reason: "not_found" };
    if (row.state !== "held" && isOperationState(row.state)) return { state: row.state, replayed: true };
    const now = input.now ?? Date.now();
    const db = getDb();
    const usageScope = and(eq(entitlementUsage.shop, input.shop), eq(entitlementUsage.key, row.key), eq(entitlementUsage.period, row.period), gte(entitlementUsage.held, row.reservedAmount));
    const [operationUpdate, usageUpdate] = await db.batch([
      db.update(entitlementOperations).set({ state: "released", updatedAt: now }).where(and(
        eq(entitlementOperations.shop, input.shop), eq(entitlementOperations.operationId, input.operationId), eq(entitlementOperations.state, "held"),
        exists(db.select({ shop: entitlementUsage.shop }).from(entitlementUsage).where(usageScope)),
      )),
      db.update(entitlementUsage).set({ held: sql`${entitlementUsage.held} - ${row.reservedAmount}`, updatedAt: now }).where(and(usageScope, eq(sql<number>`changes()`, 1))),
    ]);
    return operationUpdate.meta.changes === 1 && usageUpdate.meta.changes === 1 ? { state: "released" } : { reason: "invalid_state" };
  }
}
