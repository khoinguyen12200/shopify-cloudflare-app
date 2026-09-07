import { getDb } from "~/request-context.server";
import { sql } from "drizzle-orm";
import { entitlementOperations, entitlementUsage } from "~/db/schema";
import { entitlementAllocations } from "~/db/schema";
import type { EntitlementOperationResult } from "~/ports/entitlements";

export type OperationState = "held" | "committed" | "released";
export type AllocationState = "held" | "allocated" | "released";

function isOperationState(value: string): value is OperationState {
  return value === "held" || value === "committed" || value === "released";
}

/** D1 adapter for quota reservations and reusable concurrent allocations. */
export class EntitlementRepo {
  async allocate(input: { shop: string; key: string; allocationId: string; maximum: number; subscriptionRevision: number; now?: number }): Promise<EntitlementOperationResult> {
    const db = getDb(); const now = input.now ?? Date.now();
    const existing = (await db.select().from(entitlementAllocations).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`).limit(1))[0];
    if (existing) {
      if (existing.subscriptionRevision !== input.subscriptionRevision) return { allowed: false, reason: "conflict" };
      if (existing.state !== "released") return { allowed: true, allocationId: input.allocationId, remaining: Math.max(0, input.maximum - 1) };
    }
    const active = await db.select({ count: sql<number>`count(*)` }).from(entitlementAllocations).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.state} IN ('held','allocated')`);
    if (Number(active[0]?.count ?? 0) >= input.maximum) return { allowed: false, reason: "capacity_exhausted" };
    if (existing) await db.update(entitlementAllocations).set({ state: "allocated", updatedAt: now }).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`);
    else await db.insert(entitlementAllocations).values({ shop: input.shop, key: input.key, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, state: "allocated", createdAt: now, updatedAt: now });
    return { allowed: true, allocationId: input.allocationId, remaining: input.maximum - Number(active[0]?.count ?? 0) - 1 };
  }

  async deallocate(input: { shop: string; key: string; allocationId: string; }): Promise<EntitlementOperationResult> {
    const db = getDb();
    const row = (await db.select().from(entitlementAllocations).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`).limit(1))[0];
    if (!row) return { allowed: false, reason: "not_found" };
    if (row.state === "released") return { allowed: true, allocationId: input.allocationId };
    await db.update(entitlementAllocations).set({ state: "released", updatedAt: Date.now() }).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`);
    return { allowed: true, allocationId: input.allocationId };
  }
  async reserve(input: { shop: string; key: string; operationId: string; period: string; amount: number; maximum: number; subscriptionRevision: number; now?: number }): Promise<{ state: OperationState; reservedAmount: number; remaining: number } | { reason: "operation_conflict" | "limit_exceeded" }> {
    const now = input.now ?? Date.now();
    const db = getDb();
    const existing = await db.select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1);
    if (existing[0]) {
      const row = existing[0];
      return row.key === input.key && row.period === input.period && row.requestedAmount === input.amount && row.subscriptionRevision === input.subscriptionRevision && isOperationState(row.state)
        ? { state: row.state, reservedAmount: row.reservedAmount, remaining: Math.max(0, input.maximum - row.reservedAmount) }
        : { reason: "operation_conflict" };
    }
    const usage = await db.select().from(entitlementUsage).where(sql`${entitlementUsage.shop} = ${input.shop} AND ${entitlementUsage.key} = ${input.key} AND ${entitlementUsage.period} = ${input.period}`).limit(1);
    const committed = usage[0]?.committed ?? 0;
    const held = usage[0]?.held ?? 0;
    if (committed + held + input.amount > input.maximum) return { reason: "limit_exceeded" };
    await db.insert(entitlementOperations).values({ shop: input.shop, operationId: input.operationId, key: input.key, period: input.period, requestedAmount: input.amount, reservedAmount: input.amount, actualAmount: null, subscriptionRevision: input.subscriptionRevision, state: "held", createdAt: now, updatedAt: now });
    await db.insert(entitlementUsage).values({ shop: input.shop, key: input.key, period: input.period, committed, held: held + input.amount, updatedAt: now }).onConflictDoUpdate({ target: [entitlementUsage.shop, entitlementUsage.key, entitlementUsage.period], set: { held: held + input.amount, updatedAt: now } });
    return { state: "held", reservedAmount: input.amount, remaining: input.maximum - committed - held - input.amount };
  }

  async commit(input: { shop: string; operationId: string; actualAmount?: number; now?: number }): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" | "invalid_amount" }> {
    const row = (await getDb().select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1))[0];
    if (!row) return { reason: "not_found" };
    if (row.state !== "held") return { reason: "invalid_state" };
    const actual = input.actualAmount ?? row.reservedAmount;
    if (actual < 0 || actual > row.reservedAmount) return { reason: "invalid_amount" };
    const now = input.now ?? Date.now();
    await getDb().update(entitlementOperations).set({ state: "committed", actualAmount: actual, updatedAt: now }).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId} AND ${entitlementOperations.state} = 'held'`);
    await getDb().update(entitlementUsage).set({ held: sql`${entitlementUsage.held} - ${row.reservedAmount}`, committed: sql`${entitlementUsage.committed} + ${actual}`, updatedAt: now }).where(sql`${entitlementUsage.shop} = ${input.shop} AND ${entitlementUsage.key} = ${row.key} AND ${entitlementUsage.period} = ${row.period}`);
    return { state: "committed" };
  }

  async release(input: { shop: string; operationId: string; now?: number }): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" }> {
    const row = (await getDb().select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1))[0];
    if (!row) return { reason: "not_found" };
    if (row.state !== "held" && isOperationState(row.state)) return { state: row.state };
    const now = input.now ?? Date.now();
    await getDb().update(entitlementOperations).set({ state: "released", updatedAt: now }).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId} AND ${entitlementOperations.state} = 'held'`);
    await getDb().update(entitlementUsage).set({ held: sql`${entitlementUsage.held} - ${row.reservedAmount}`, updatedAt: now }).where(sql`${entitlementUsage.shop} = ${input.shop} AND ${entitlementUsage.key} = ${row.key} AND ${entitlementUsage.period} = ${row.period}`);
    return { state: "released" };
  }
}
