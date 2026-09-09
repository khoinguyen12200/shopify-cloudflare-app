import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { EntitlementRepo } from "./entitlements.server";

setupTestDatabase();

async function seedProjection(shop: string, revision = 1) {
  await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id,revision) VALUES (?,?,?,?,?,?)")
    .bind(shop, "subscription", "ACTIVE", 1, "event", revision).run();
}

describe("EntitlementRepo", () => {
  it("classifies quota exhaustion using numeric revision rather than event time", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("exhaustion", 3);
      const repo = new EntitlementRepo();
      const quota = { shop: "exhaustion", key: "exports", operationId: "a", period: "lifetime", amount: 1, maximum: 1, subscriptionRevision: 3 };
      expect(await repo.reserve(quota)).toMatchObject({ allowed: true });
      expect(await repo.reserve({ ...quota, operationId: "b" })).toEqual({ allowed: false, reason: "quota_exhausted" });
    });
  });

  it("classifies capacity exhaustion using numeric revision rather than event time", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("exhaustion", 3);
      const repo = new EntitlementRepo();
      const capacity = { shop: "exhaustion", key: "staff", allocationId: "a", operationId: "op-a", maximum: 1, subscriptionRevision: 3 };
      expect(await repo.allocate(capacity)).toMatchObject({ allowed: true });
      expect(await repo.allocate({ ...capacity, allocationId: "b", operationId: "op-b" })).toEqual({ allowed: false, reason: "capacity_exhausted" });
    });
  });
  it("enforces a capacity maximum and returns the slot after release", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("one");
      const repo = new EntitlementRepo();
      expect(await repo.allocate({ shop: "one", key: "staff.max", allocationId: "staff-1", operationId: "op-staff-1", maximum: 1, subscriptionRevision: 1 })).toMatchObject({ allowed: true });
      expect(await env.DB.prepare("SELECT state FROM entitlement_allocations WHERE shop='one'").first()).toEqual({ state: "held" });
      expect(await repo.allocate({ shop: "one", key: "staff.max", allocationId: "staff-2", operationId: "op-staff-2", maximum: 1, subscriptionRevision: 1 })).toEqual({ allowed: false, reason: "capacity_exhausted" });
      expect(await repo.deallocate({ shop: "one", key: "staff.max", allocationId: "staff-1", operationId: "op-staff-1" })).toMatchObject({ allowed: true });
      expect(await repo.allocate({ shop: "one", key: "staff.max", allocationId: "staff-2", operationId: "op-staff-2", maximum: 1, subscriptionRevision: 1 })).toMatchObject({ allowed: true });
    });
  });

  it("atomically admits only one of two concurrent allocations at a one-slot limit", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("race");
      const repo = new EntitlementRepo();
      const results = await Promise.all([
        repo.allocate({ shop: "race", key: "staff.max", allocationId: "staff-1", operationId: "op-staff-1", maximum: 1, subscriptionRevision: 1 }),
        repo.allocate({ shop: "race", key: "staff.max", allocationId: "staff-2", operationId: "op-staff-2", maximum: 1, subscriptionRevision: 1 }),
      ]);
      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(results.filter((result) => !result.allowed)).toEqual([{ allowed: false, reason: "capacity_exhausted" }]);
    });
  });

  it("rejects a concurrent allocation that reuses an operation ID with different input", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("operation-race");
      const repo = new EntitlementRepo();
      const results = await Promise.all([
        repo.allocate({ shop: "operation-race", key: "staff.max", allocationId: "staff-1", operationId: "same-operation", maximum: 2, subscriptionRevision: 1 }),
        repo.allocate({ shop: "operation-race", key: "staff.max", allocationId: "staff-2", operationId: "same-operation", maximum: 2, subscriptionRevision: 1 }),
      ]);

      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(results.filter((result) => !result.allowed)).toEqual([{ allowed: false, reason: "operation_conflict" }]);
    });
  });

  it("keeps capacity retries idempotent and rejects revision conflicts", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("capacity-replay", 4);
      const repo = new EntitlementRepo();
      const input = { shop: "capacity-replay", key: "staff.max", allocationId: "staff-1", operationId: "op-staff-1", maximum: 2, subscriptionRevision: 4 };
      expect(await repo.allocate(input)).toMatchObject({ allowed: true, allocationId: "staff-1", operationId: "op-staff-1", subscriptionRevision: 4, remaining: 1 });
      expect(await repo.allocate(input)).toMatchObject({ allowed: true, allocationId: "staff-1", operationId: "op-staff-1", subscriptionRevision: 4, remaining: 1 });
      expect(await repo.allocate({ ...input, subscriptionRevision: 5 })).toEqual({ allowed: false, reason: "conflict" });
      expect(await repo.deallocate({ shop: input.shop, key: input.key, allocationId: input.allocationId, operationId: input.operationId })).toEqual({ allowed: true, allocationId: "staff-1", operationId: "op-staff-1", state: "released" });
      expect(await repo.deallocate({ shop: input.shop, key: input.key, allocationId: input.allocationId, operationId: input.operationId })).toEqual({ allowed: true, allocationId: "staff-1", operationId: "op-staff-1", state: "released" });
    });
  });
  it("deallocates only an active allocation", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("deallocate-guard");
      const repo = new EntitlementRepo();
      await repo.allocate({ shop: "deallocate-guard", key: "staff.max", allocationId: "a", operationId: "op-a", maximum: 1, subscriptionRevision: 1 });
      expect(await repo.deallocate({ shop: "deallocate-guard", key: "staff.max", allocationId: "a", operationId: "op-a" })).toMatchObject({ allowed: true, state: "released" });
      expect(await repo.deallocate({ shop: "deallocate-guard", key: "staff.max", allocationId: "missing", operationId: "op-missing" })).toEqual({ allowed: false, reason: "not_found" });
    });
  });

  it("does not write a second release under concurrent deallocation", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("conditional-deallocation");
      const repo = new EntitlementRepo();
      const input = { shop: "conditional-deallocation", key: "staff.max", allocationId: "a", operationId: "op-a" };
      await repo.allocate({ ...input, maximum: 1, subscriptionRevision: 1 });
      await env.DB.prepare(`CREATE TRIGGER reject_redundant_allocation_release BEFORE UPDATE ON entitlement_allocations
        WHEN OLD.shop = 'conditional-deallocation' AND OLD.state = 'released' AND NEW.state = 'released'
        BEGIN SELECT RAISE(ABORT, 'allocation released twice'); END`).run();
      try {
        const results = await Promise.all([repo.deallocate(input), repo.deallocate(input)]);
        expect(results).toEqual([
          { allowed: true, allocationId: "a", operationId: "op-a", state: "released" },
          { allowed: true, allocationId: "a", operationId: "op-a", state: "released" },
        ]);
      } finally {
        await env.DB.prepare("DROP TRIGGER reject_redundant_allocation_release").run();
      }
    });
  });

  it.each(["commit", "release"])("preserves held state when %s has no matching aggregate", async (action) => {
    await runWithRequestContext(env, async () => {
      await seedProjection("missing-aggregate");
      const repo = new EntitlementRepo();
      const input = { shop: "missing-aggregate", operationId: "op" };
      await repo.reserve({ ...input, key: "exports", period: "lifetime", amount: 2, maximum: 2, subscriptionRevision: 1 });
      await env.DB.prepare("DELETE FROM entitlement_usage WHERE shop = ?").bind(input.shop).run();
      const result = action === "commit" ? await repo.commit(input) : await repo.release(input);
      expect(result).toEqual({ reason: "invalid_state" });
      expect(await repo.listHeld(input.shop)).toMatchObject([{ operationId: "op", key: "exports", period: "lifetime", amount: 2 }]);
    });
  });

  it.each(["commit", "release"])("rolls back %s when the aggregate SQL write fails", async (action) => {
    await runWithRequestContext(env, async () => {
      await seedProjection("aggregate-error");
      const repo = new EntitlementRepo();
      const input = { shop: "aggregate-error", operationId: "op" };
      await repo.reserve({ ...input, key: "exports", period: "lifetime", amount: 2, maximum: 2, subscriptionRevision: 1 });
      await env.DB.prepare(`CREATE TRIGGER reject_usage_update BEFORE UPDATE ON entitlement_usage
        WHEN OLD.shop = 'aggregate-error' BEGIN SELECT RAISE(ABORT, 'usage write failed'); END`).run();
      try {
        await expect(action === "commit" ? repo.commit(input) : repo.release(input)).rejects.toThrow("usage write failed");
        expect(await repo.listHeld(input.shop)).toHaveLength(1);
        expect(await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind(input.shop).first()).toEqual({ committed: 0, held: 2 });
      } finally {
        await env.DB.prepare("DROP TRIGGER reject_usage_update").run();
      }
    });
  });

  it("rejects capacity writes when the projection revision has advanced", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id) VALUES (?,?,?,?,?)").bind("revision-cap", "sub", "ACTIVE", 9, "evt").run();
      expect(await repo.allocate({ shop: "revision-cap", key: "staff.max", allocationId: "a", operationId: "op-a", maximum: 1, subscriptionRevision: 8 })).toEqual({ allowed: false, reason: "conflict" });
    });
  });

  it("rejects quota writes when the projection revision has advanced", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id) VALUES (?,?,?,?,?)").bind("revision-quota", "sub", "ACTIVE", 9, "evt").run();
      expect(await repo.reserve({ shop: "revision-quota", key: "exports", operationId: "op", period: "lifetime", amount: 1, maximum: 2, subscriptionRevision: 8 })).toEqual({ allowed: false, reason: "operation_conflict" });
    });
  });

  it("requires an initialized projection and matches its numeric revision", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      expect(await repo.reserve({ shop: "missing-projection", key: "exports", operationId: "op", period: "lifetime", amount: 1, maximum: 2, subscriptionRevision: 1 })).toEqual({ allowed: false, reason: "quota_exhausted" });
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id,revision) VALUES (?,?,?,?,?,?)").bind("revision-match", "sub", "ACTIVE", 9, "evt", 3).run();
      expect(await repo.reserve({ shop: "revision-match", key: "exports", operationId: "op", period: "lifetime", amount: 1, maximum: 2, subscriptionRevision: 3 })).toMatchObject({ allowed: true });
    });
  });

  it("keeps quota usage isolated by shop and makes replay idempotent", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("one");
      await seedProjection("two");
      const repo = new EntitlementRepo();
      const input = { shop: "one", key: "exports", operationId: "op-1", period: "lifetime", amount: 3, maximum: 5, subscriptionRevision: 1 };
      expect(await repo.reserve(input)).toMatchObject({ allowed: true, amount: 3, remaining: 2 });
      expect(await repo.reserve(input)).toMatchObject({ allowed: true });
      expect(await repo.reserve({ ...input, shop: "two" })).toMatchObject({ allowed: true });
      expect(await repo.reserve({ ...input, operationId: "op-2", amount: 3 })).toEqual({ allowed: false, reason: "quota_exhausted" });
      expect(await repo.commit({ shop: "one", operationId: "op-1", actualAmount: 2 })).toEqual({ state: "committed" });
      expect(await repo.commit({ shop: "one", operationId: "op-1", actualAmount: 2 })).toEqual({ state: "committed", replayed: true });
      const usage = await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("one").first<{ committed: number; held: number }>();
      expect(usage).toEqual({ committed: 2, held: 0 });
    });
  });

  it("reports replay remaining from aggregate usage, not only the replay amount", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("aggregate-replay");
      const repo = new EntitlementRepo();
      await repo.reserve({ shop: "aggregate-replay", key: "exports", operationId: "first", period: "lifetime", amount: 2, maximum: 5, subscriptionRevision: 1 });
      await repo.reserve({ shop: "aggregate-replay", key: "exports", operationId: "second", period: "lifetime", amount: 1, maximum: 5, subscriptionRevision: 1 });
      const replay = await repo.reserve({ shop: "aggregate-replay", key: "exports", operationId: "first", period: "lifetime", amount: 2, maximum: 5, subscriptionRevision: 1 });
      expect(replay).toMatchObject({ remaining: 2 });
    });
  });

  it("never admits concurrent reservations beyond the quota maximum", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("quota-race");
      const repo = new EntitlementRepo();
      const results = await Promise.all([
        repo.reserve({ shop: "quota-race", key: "exports", operationId: "a", period: "lifetime", amount: 1, maximum: 1, subscriptionRevision: 1 }),
        repo.reserve({ shop: "quota-race", key: "exports", operationId: "b", period: "lifetime", amount: 1, maximum: 1, subscriptionRevision: 1 }),
      ]);
      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(results.filter((result) => !result.allowed)).toEqual([{ allowed: false, reason: "quota_exhausted" }]);
      const usage = await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("quota-race").first<{ committed: number; held: number }>();
      expect(usage).toEqual({ committed: 0, held: 1 });
      const operations = await env.DB.prepare("SELECT count(*) AS count FROM entitlement_operations WHERE shop = ?").bind("quota-race").first<{ count: number }>();
      expect(operations?.count).toBe(1);
    });
  });

  it("commits a held reservation exactly once under concurrent retries", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("commit-race");
      const repo = new EntitlementRepo();
      await repo.reserve({ shop: "commit-race", key: "exports", operationId: "op", period: "lifetime", amount: 3, maximum: 5, subscriptionRevision: 1 });
      await repo.reserve({ shop: "commit-race", key: "exports", operationId: "other", period: "lifetime", amount: 3, maximum: 6, subscriptionRevision: 1 });
      const results = await Promise.all([
        repo.commit({ shop: "commit-race", operationId: "op", actualAmount: 2 }),
        repo.commit({ shop: "commit-race", operationId: "op", actualAmount: 2 }),
      ]);
      expect(results.filter((result) => "state" in result && result.state === "committed")).toHaveLength(1);
      const usage = await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("commit-race").first<{ committed: number; held: number }>();
      expect(usage).toEqual({ committed: 2, held: 3 });
    });
  });

  it("releases a held reservation exactly once under concurrent retries", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("release-race");
      const repo = new EntitlementRepo();
      await repo.reserve({ shop: "release-race", key: "exports", operationId: "op", period: "lifetime", amount: 3, maximum: 5, subscriptionRevision: 1 });
      await repo.reserve({ shop: "release-race", key: "exports", operationId: "other", period: "lifetime", amount: 2, maximum: 5, subscriptionRevision: 1 });
      await Promise.all([
        repo.release({ shop: "release-race", operationId: "op" }),
        repo.release({ shop: "release-race", operationId: "op" }),
      ]);
      const usage = await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("release-race").first<{ committed: number; held: number }>();
      expect(usage).toEqual({ committed: 0, held: 2 });
    });
  });

  it("lists and explicitly reconciles crash-left held operations", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("one");
      const repo = new EntitlementRepo();
      await repo.reserve({ shop: "one", key: "exports", operationId: "held", period: "month", amount: 1, maximum: 2, subscriptionRevision: 1 });
      expect(await repo.listHeld("two")).toEqual([]);
      expect(await repo.listHeld("one")).toMatchObject([{ operationId: "held", key: "exports", period: "month", amount: 1 }]);
      expect(await repo.reconcileHeld("one", "held", "release")).toEqual({ state: "released" });
      expect(await repo.listHeld("one")).toEqual([]);
    });
  });

  it("lists held capacity allocations by shop", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("capacity-held");
      const repo = new EntitlementRepo();
      await repo.allocate({ shop: "capacity-held", key: "staff.max", allocationId: "staff-1", operationId: "op-staff-1", maximum: 1, subscriptionRevision: 1 });
      await env.DB.prepare("UPDATE entitlement_allocations SET state = 'held' WHERE shop = ?").bind("capacity-held").run();
      expect(await repo.listHeldAllocations("capacity-held")).toMatchObject([{ key: "staff.max", allocationId: "staff-1", operationId: "op-staff-1" }]);
      expect(await repo.listHeldAllocations("other-shop")).toEqual([]);
    });
  });

  it("replays an allocated capacity attempt as allocated", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await seedProjection("capacity-replay-state");
      await expect(repo.allocate({ shop: "capacity-replay-state", key: "staff.max", allocationId: "staff-1", operationId: "op-1", maximum: 1, subscriptionRevision: 1 })).resolves.toMatchObject({ allowed: true, state: "held" });
      await expect(repo.confirmAllocation({ shop: "capacity-replay-state", key: "staff.max", allocationId: "staff-1", operationId: "op-1" })).resolves.toEqual({ allowed: true, allocationId: "staff-1", state: "allocated" });
      await expect(repo.allocate({ shop: "capacity-replay-state", key: "staff.max", allocationId: "staff-1", operationId: "op-1", maximum: 1, subscriptionRevision: 1 })).resolves.toMatchObject({ allowed: true, state: "allocated" });
    });
  });

  it("rejects confirmation with the wrong resource identity", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("confirm-identity");
      const repo = new EntitlementRepo();
      await repo.allocate({ shop: "confirm-identity", key: "staff.max", allocationId: "staff-1", operationId: "real-op", maximum: 1, subscriptionRevision: 1 });
      expect(await repo.confirmAllocation({ shop: "confirm-identity", key: "wrong.key", allocationId: "wrong-resource", operationId: "real-op" })).toEqual({ allowed: false, reason: "operation_conflict" });
      expect(await env.DB.prepare("SELECT state FROM entitlement_allocations WHERE shop=? AND operation_id=?").bind("confirm-identity", "real-op").first()).toEqual({ state: "held" });
    });
  });

  it("does not reconcile a capacity attempt with the wrong operation identity", async () => {
    await runWithRequestContext(env, async () => {
      await seedProjection("capacity-identity");
      const repo = new EntitlementRepo();
      await repo.allocate({ shop: "capacity-identity", key: "staff.max", allocationId: "staff-1", operationId: "real-op", maximum: 1, subscriptionRevision: 1 });
      const result = await repo.applyReconciliation("capacity-identity", { kind: "capacity", shop: "capacity-identity", key: "staff.max", id: "staff-1", operationId: "wrong-op", createdAt: 1 }, "confirm");
      expect(result).toEqual({ reason: "invalid_state" });
      expect(await env.DB.prepare("SELECT state FROM entitlement_allocations WHERE shop=? AND allocation_id=?").bind("capacity-identity", "staff-1").first()).toEqual({ state: "held" });
    });
  });
});
