import { getDb, getEnv } from "~/request-context.server";
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
  async listHeldAllocations(shop: string): Promise<readonly { key: string; allocationId: string }[]> {
    return getDb()
      .select({ key: entitlementAllocations.key, allocationId: entitlementAllocations.allocationId })
      .from(entitlementAllocations)
      .where(sql`${entitlementAllocations.shop} = ${shop} AND ${entitlementAllocations.state} = 'held'`);
  }

  async listHeld(shop: string): Promise<readonly { operationId: string; key: string; period: string; amount: number }[]> {
    const rows = await getDb().select({ operationId: entitlementOperations.operationId, key: entitlementOperations.key, period: entitlementOperations.period, amount: entitlementOperations.reservedAmount }).from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${shop} AND ${entitlementOperations.state} = 'held'`);
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
  async allocate(input: { shop: string; key: string; allocationId: string; maximum: number; subscriptionRevision: number; now?: number }): Promise<EntitlementOperationResult> {
    const db = getDb(); const now = input.now ?? Date.now();
    const existing = (await db.select().from(entitlementAllocations).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`).limit(1))[0];
    if (existing) {
      if (existing.subscriptionRevision !== input.subscriptionRevision) return { allowed: false, reason: "conflict" };
      if (existing.state !== "released") return { allowed: true, allocationId: input.allocationId, remaining: Math.max(0, input.maximum - 1) };
    }
    const d1 = getEnv().DB;
    const [held] = await d1.batch([d1.prepare("INSERT INTO entitlement_allocations (shop,key,allocation_id,subscription_revision,state,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT count(*) FROM entitlement_allocations WHERE shop=? AND key=? AND state IN ('held','allocated')) < ? ON CONFLICT(shop,key,allocation_id) DO UPDATE SET state='held',subscription_revision=excluded.subscription_revision,updated_at=excluded.updated_at WHERE entitlement_allocations.state='released'").bind(input.shop, input.key, input.allocationId, input.subscriptionRevision, "held", now, now, input.shop, input.key, input.maximum)]);
    if (held.meta.changes !== 1) return { allowed: false, reason: "capacity_exhausted" };
    await d1.batch([d1.prepare("UPDATE entitlement_allocations SET state='allocated', updated_at=? WHERE shop=? AND key=? AND allocation_id=? AND state='held'").bind(now, input.shop, input.key, input.allocationId)]);
    const count = await d1.prepare("SELECT count(*) count FROM entitlement_allocations WHERE shop=? AND key=? AND state IN ('held','allocated')").bind(input.shop, input.key).first<{ count: number }>();
    return { allowed: true, allocationId: input.allocationId, remaining: input.maximum - Number(count?.count ?? 0) };
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
    const d1 = getEnv().DB;
    const [, inserted, updated] = await d1.batch([
      d1.prepare("INSERT OR IGNORE INTO entitlement_usage (shop, key, period, committed, held, updated_at) VALUES (?, ?, ?, 0, 0, ?)").bind(input.shop, input.key, input.period, now),
      d1.prepare("INSERT OR IGNORE INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, NULL, ?, 'held', ?, ? WHERE EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND committed + held + ? <= ?)").bind(input.shop, input.operationId, input.key, input.period, input.amount, input.amount, input.subscriptionRevision, now, now, input.shop, input.key, input.period, input.amount, input.maximum),
      d1.prepare("UPDATE entitlement_usage SET held = held + ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND changes() = 1").bind(input.amount, now, input.shop, input.key, input.period),
    ]);
    if (inserted.meta.changes !== 1 || updated.meta.changes !== 1) {
      const raced = (await db.select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1))[0];
      if (!raced) return { reason: "limit_exceeded" };
      return raced.key === input.key && raced.period === input.period && raced.requestedAmount === input.amount && raced.subscriptionRevision === input.subscriptionRevision && isOperationState(raced.state)
        ? { state: raced.state, reservedAmount: raced.reservedAmount, remaining: Math.max(0, input.maximum - raced.reservedAmount) }
        : { reason: "operation_conflict" };
    }
    const aggregate = await d1.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ?").bind(input.shop, input.key, input.period).first<{ committed: number; held: number }>();
    return { state: "held", reservedAmount: input.amount, remaining: input.maximum - Number(aggregate?.committed ?? 0) - Number(aggregate?.held ?? 0) };
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
