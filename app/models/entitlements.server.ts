import { getDb, getEnv } from "~/request-context.server";
import { sql } from "drizzle-orm";
import { entitlementOperations } from "~/db/schema";
import { entitlementAllocations } from "~/db/schema";
import type { AllocateResult, DeallocateResult, ReserveResult } from "~/ports/entitlements";
import type { HeldItem, HeldDecision, ReconciliationResult } from "~/ports/entitlement-reconciliation";

async function d1Count(shop: string, key: string): Promise<number> {
  const row = await getEnv().DB.prepare("SELECT count(*) AS count FROM entitlement_allocations WHERE shop=? AND key=? AND state IN ('held','allocated')").bind(shop, key).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

async function usageRemaining(shop: string, key: string, period: string, maximum: number): Promise<number> {
  const row = await getEnv().DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop=? AND key=? AND period=?").bind(shop, key, period).first<{ committed: number; held: number }>();
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
      await getEnv().DB.prepare("UPDATE entitlement_allocations SET state=?, updated_at=? WHERE shop=? AND key=? AND allocation_id=? AND state='held'").bind(state, Date.now(), shop, item.key, item.id).run();
      const row = await getEnv().DB.prepare("SELECT state FROM entitlement_allocations WHERE shop=? AND key=? AND allocation_id=?").bind(shop, item.key, item.id).first<{ state: string }>();
      if (!row) return { reason: "not_found" };
      return row.state === state ? { state } : { reason: "invalid_state" };
    }
    if (decision !== "commit" && decision !== "release") return { reason: "invalid_decision" };
    const row = await getEnv().DB.prepare("SELECT state FROM entitlement_operations WHERE shop=? AND key=? AND operation_id=?").bind(shop, item.key, item.id).first<{ state: string }>();
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
  async allocate(input: { shop: string; key: string; allocationId: string; maximum: number; subscriptionRevision: number; now?: number }): Promise<AllocateResult> {
    const db = getDb(); const now = input.now ?? Date.now();
    const existing = (await db.select().from(entitlementAllocations).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`).limit(1))[0];
    if (existing) {
      if (existing.subscriptionRevision !== input.subscriptionRevision) return { allowed: false, reason: "conflict" };
      if (existing.state !== "released") {
        const count = await d1Count(input.shop, input.key);
        return { allowed: true, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, remaining: Math.max(0, input.maximum - count) };
      }
    }
    const d1 = getEnv().DB;
    const [held] = await d1.batch([d1.prepare("INSERT INTO entitlement_allocations (shop,key,allocation_id,subscription_revision,state,created_at,updated_at) SELECT ?,?,?,?,?,?,? WHERE (NOT EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop=?) OR EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop=? AND applied_occurred_at=? AND NOT EXISTS (SELECT 1 FROM shop_subscriptions newer WHERE newer.shop=? AND newer.applied_occurred_at>?))) AND (SELECT count(*) FROM entitlement_allocations WHERE shop=? AND key=? AND state IN ('held','allocated')) < ? ON CONFLICT(shop,key,allocation_id) DO UPDATE SET state='held',subscription_revision=excluded.subscription_revision,updated_at=excluded.updated_at WHERE entitlement_allocations.state='released'").bind(input.shop, input.key, input.allocationId, input.subscriptionRevision, "held", now, now, input.shop, input.subscriptionRevision, input.shop, input.key, input.maximum)]);
    if (held.meta.changes !== 1) {
      const projection = await d1.prepare("SELECT max(applied_occurred_at) AS revision FROM shop_subscriptions WHERE shop=?").bind(input.shop).first<{ revision: number | null }>();
      return { allowed: false, reason: projection?.revision !== null && projection?.revision !== input.subscriptionRevision ? "conflict" : "capacity_exhausted" };
    }
    await d1.batch([d1.prepare("UPDATE entitlement_allocations SET state='allocated', updated_at=? WHERE shop=? AND key=? AND allocation_id=? AND state='held'").bind(now, input.shop, input.key, input.allocationId)]);
    const count = await d1.prepare("SELECT count(*) count FROM entitlement_allocations WHERE shop=? AND key=? AND state IN ('held','allocated')").bind(input.shop, input.key).first<{ count: number }>();
    return { allowed: true, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, remaining: input.maximum - Number(count?.count ?? 0) };
  }

  async deallocate(input: { shop: string; key: string; allocationId: string; }): Promise<DeallocateResult> {
    const db = getDb();
    const released = await db.update(entitlementAllocations).set({ state: "released", updatedAt: Date.now() }).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId} AND ${entitlementAllocations.state} IN ('held','allocated')`).returning({ allocationId: entitlementAllocations.allocationId });
    if (released.length > 0) return { allowed: true, allocationId: input.allocationId, state: "released" };
    const row = (await db.select().from(entitlementAllocations).where(sql`${entitlementAllocations.shop} = ${input.shop} AND ${entitlementAllocations.key} = ${input.key} AND ${entitlementAllocations.allocationId} = ${input.allocationId}`).limit(1))[0];
    if (!row) return { allowed: false, reason: "not_found" };
    if (row.state === "released") return { allowed: true, allocationId: input.allocationId, state: "released" };
    return { allowed: false, reason: "invalid_state" };
  }
  async reserve(input: { shop: string; key: string; operationId: string; period: string; amount: number; maximum: number; subscriptionRevision: number; now?: number }): Promise<ReserveResult> {
    const now = input.now ?? Date.now();
    const db = getDb();
    const existing = await db.select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1);
    if (existing[0]) {
      const row = existing[0];
      return row.key === input.key && row.period === input.period && row.requestedAmount === input.amount && row.subscriptionRevision === input.subscriptionRevision && isOperationState(row.state)
        ? { allowed: true, operationId: input.operationId, amount: row.reservedAmount, period: row.period, subscriptionRevision: row.subscriptionRevision, remaining: await usageRemaining(input.shop, input.key, input.period, input.maximum) }
        : { allowed: false, reason: "operation_conflict" };
    }
    const d1 = getEnv().DB;
    const [, inserted, updated] = await d1.batch([
      d1.prepare("INSERT OR IGNORE INTO entitlement_usage (shop, key, period, committed, held, updated_at) VALUES (?, ?, ?, 0, 0, ?)").bind(input.shop, input.key, input.period, now),
      d1.prepare("INSERT OR IGNORE INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, NULL, ?, 'held', ?, ? WHERE EXISTS (SELECT 1 FROM shop_subscriptions WHERE shop=? AND revision=? AND status IN ('ACTIVE','CANCELLATION_SCHEDULED')) AND EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND committed + held + ? <= ?)").bind(input.shop, input.operationId, input.key, input.period, input.amount, input.amount, input.subscriptionRevision, now, now, input.shop, input.subscriptionRevision, input.shop, input.key, input.period, input.amount, input.maximum),
      d1.prepare("UPDATE entitlement_usage SET held = held + ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND changes() = 1").bind(input.amount, now, input.shop, input.key, input.period),
    ]);
    if (inserted.meta.changes !== 1 || updated.meta.changes !== 1) {
      const raced = (await db.select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1))[0];
      if (!raced) {
        const projection = await d1.prepare("SELECT max(applied_occurred_at) AS revision FROM shop_subscriptions WHERE shop=?").bind(input.shop).first<{ revision: number | null }>();
        return { allowed: false, reason: typeof projection?.revision === "number" && projection.revision !== input.subscriptionRevision ? "operation_conflict" : "quota_exhausted" };
      }
      return raced.key === input.key && raced.period === input.period && raced.requestedAmount === input.amount && raced.subscriptionRevision === input.subscriptionRevision && isOperationState(raced.state)
        ? { allowed: true, operationId: input.operationId, amount: raced.reservedAmount, period: raced.period, subscriptionRevision: raced.subscriptionRevision, remaining: await usageRemaining(input.shop, input.key, input.period, input.maximum) }
        : { allowed: false, reason: "operation_conflict" };
    }
    const aggregate = await d1.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ?").bind(input.shop, input.key, input.period).first<{ committed: number; held: number }>();
    return { allowed: true, operationId: input.operationId, amount: input.amount, period: input.period, subscriptionRevision: input.subscriptionRevision, remaining: input.maximum - Number(aggregate?.committed ?? 0) - Number(aggregate?.held ?? 0) };
  }

  async commit(input: { shop: string; operationId: string; actualAmount?: number; now?: number }): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" | "invalid_amount" }> {
    const row = (await getDb().select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1))[0];
    if (!row) return { reason: "not_found" };
    if (row.state !== "held") return { reason: "invalid_state" };
    const actual = input.actualAmount ?? row.reservedAmount;
    if (actual < 0 || actual > row.reservedAmount) return { reason: "invalid_amount" };
    const now = input.now ?? Date.now();
    const d1 = getEnv().DB;
    const [operationUpdate, usageUpdate] = await d1.batch([
      d1.prepare("UPDATE entitlement_operations SET state = 'committed', actual_amount = ?, updated_at = ? WHERE shop = ? AND operation_id = ? AND state = 'held' AND EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND held >= ?)").bind(actual, now, input.shop, input.operationId, input.shop, row.key, row.period, row.reservedAmount),
      d1.prepare("UPDATE entitlement_usage SET held = held - ?, committed = committed + ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND held >= ? AND changes() = 1").bind(row.reservedAmount, actual, now, input.shop, row.key, row.period, row.reservedAmount),
    ]);
    return operationUpdate.meta.changes === 1 && usageUpdate.meta.changes === 1 ? { state: "committed" } : { reason: "invalid_state" };
  }

  async release(input: { shop: string; operationId: string; now?: number }): Promise<{ state: OperationState } | { reason: "not_found" | "invalid_state" }> {
    const row = (await getDb().select().from(entitlementOperations).where(sql`${entitlementOperations.shop} = ${input.shop} AND ${entitlementOperations.operationId} = ${input.operationId}`).limit(1))[0];
    if (!row) return { reason: "not_found" };
    if (row.state !== "held" && isOperationState(row.state)) return { state: row.state };
    const now = input.now ?? Date.now();
    const d1 = getEnv().DB;
    const [operationUpdate, usageUpdate] = await d1.batch([
      d1.prepare("UPDATE entitlement_operations SET state = 'released', updated_at = ? WHERE shop = ? AND operation_id = ? AND state = 'held' AND EXISTS (SELECT 1 FROM entitlement_usage WHERE shop = ? AND key = ? AND period = ? AND held >= ?)").bind(now, input.shop, input.operationId, input.shop, row.key, row.period, row.reservedAmount),
      d1.prepare("UPDATE entitlement_usage SET held = held - ?, updated_at = ? WHERE shop = ? AND key = ? AND period = ? AND held >= ? AND changes() = 1").bind(row.reservedAmount, now, input.shop, row.key, row.period, row.reservedAmount),
    ]);
    return operationUpdate.meta.changes === 1 && usageUpdate.meta.changes === 1 ? { state: "released" } : { reason: "invalid_state" };
  }
}
