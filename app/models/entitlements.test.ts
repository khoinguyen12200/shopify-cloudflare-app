import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { EntitlementRepo } from "./entitlements.server";

setupTestDatabase();

describe("EntitlementRepo", () => {
  it("enforces a capacity maximum and returns the slot after release", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      expect(await repo.allocate({ shop: "one", key: "staff.max", allocationId: "staff-1", maximum: 1, subscriptionRevision: 1 })).toMatchObject({ allowed: true });
      expect(await repo.allocate({ shop: "one", key: "staff.max", allocationId: "staff-2", maximum: 1, subscriptionRevision: 1 })).toEqual({ allowed: false, reason: "capacity_exhausted" });
      expect(await repo.deallocate({ shop: "one", key: "staff.max", allocationId: "staff-1" })).toMatchObject({ allowed: true });
      expect(await repo.allocate({ shop: "one", key: "staff.max", allocationId: "staff-2", maximum: 1, subscriptionRevision: 1 })).toMatchObject({ allowed: true });
    });
  });

  it("atomically admits only one of two concurrent allocations at a one-slot limit", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      const results = await Promise.all([
        repo.allocate({ shop: "race", key: "staff.max", allocationId: "staff-1", maximum: 1, subscriptionRevision: 1 }),
        repo.allocate({ shop: "race", key: "staff.max", allocationId: "staff-2", maximum: 1, subscriptionRevision: 1 }),
      ]);
      expect(results.filter((result) => result.allowed)).toHaveLength(1);
      expect(results.filter((result) => !result.allowed)).toEqual([{ allowed: false, reason: "capacity_exhausted" }]);
    });
  });

  it("keeps capacity retries idempotent and rejects revision conflicts", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      const input = { shop: "capacity-replay", key: "staff.max", allocationId: "staff-1", maximum: 2, subscriptionRevision: 4 };
      expect(await repo.allocate(input)).toMatchObject({ allowed: true, allocationId: "staff-1", subscriptionRevision: 4, remaining: 1 });
      expect(await repo.allocate(input)).toMatchObject({ allowed: true, allocationId: "staff-1", subscriptionRevision: 4, remaining: 1 });
      expect(await repo.allocate({ ...input, subscriptionRevision: 5 })).toEqual({ allowed: false, reason: "conflict" });
      expect(await repo.deallocate({ shop: input.shop, key: input.key, allocationId: input.allocationId })).toEqual({ allowed: true, allocationId: "staff-1", state: "released" });
      expect(await repo.deallocate({ shop: input.shop, key: input.key, allocationId: input.allocationId })).toEqual({ allowed: true, allocationId: "staff-1", state: "released" });
    });
  });

  it("rejects capacity writes when the projection revision has advanced", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id) VALUES (?,?,?,?,?)").bind("revision-cap", "sub", "ACTIVE", 9, "evt").run();
      expect(await repo.allocate({ shop: "revision-cap", key: "staff.max", allocationId: "a", maximum: 1, subscriptionRevision: 8 })).toEqual({ allowed: false, reason: "conflict" });
    });
  });

  it("rejects quota writes when the projection revision has advanced", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id) VALUES (?,?,?,?,?)").bind("revision-quota", "sub", "ACTIVE", 9, "evt").run();
      expect(await repo.reserve({ shop: "revision-quota", key: "exports", operationId: "op", period: "lifetime", amount: 1, maximum: 2, subscriptionRevision: 8 })).toEqual({ allowed: false, reason: "operation_conflict" });
    });
  });

  it("keeps quota usage isolated by shop and makes replay idempotent", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      const input = { shop: "one", key: "exports", operationId: "op-1", period: "lifetime", amount: 3, maximum: 5, subscriptionRevision: 1 };
      expect(await repo.reserve(input)).toMatchObject({ allowed: true, amount: 3, remaining: 2 });
      expect(await repo.reserve(input)).toMatchObject({ allowed: true });
      expect(await repo.reserve({ ...input, shop: "two" })).toMatchObject({ allowed: true });
      expect(await repo.reserve({ ...input, operationId: "op-2", amount: 3 })).toEqual({ allowed: false, reason: "quota_exhausted" });
      expect(await repo.commit({ shop: "one", operationId: "op-1", actualAmount: 2 })).toEqual({ state: "committed" });
      const usage = await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("one").first<{ committed: number; held: number }>();
      expect(usage).toEqual({ committed: 2, held: 0 });
    });
  });

  it("reports replay remaining from aggregate usage, not only the replay amount", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await repo.reserve({ shop: "aggregate-replay", key: "exports", operationId: "first", period: "lifetime", amount: 2, maximum: 5, subscriptionRevision: 1 });
      await repo.reserve({ shop: "aggregate-replay", key: "exports", operationId: "second", period: "lifetime", amount: 1, maximum: 5, subscriptionRevision: 1 });
      const replay = await repo.reserve({ shop: "aggregate-replay", key: "exports", operationId: "first", period: "lifetime", amount: 2, maximum: 5, subscriptionRevision: 1 });
      expect(replay).toMatchObject({ remaining: 2 });
    });
  });

  it("never admits concurrent reservations beyond the quota maximum", async () => {
    await runWithRequestContext(env, async () => {
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
      const repo = new EntitlementRepo();
      await repo.reserve({ shop: "one", key: "exports", operationId: "held", period: "month", amount: 1, maximum: 2, subscriptionRevision: 1 });
      expect(await repo.listHeld("two")).toEqual([]);
      expect(await repo.listHeld("one")).toEqual([{ operationId: "held", key: "exports", period: "month", amount: 1 }]);
      expect(await repo.reconcileHeld("one", "held", "release")).toEqual({ state: "released" });
      expect(await repo.listHeld("one")).toEqual([]);
    });
  });

  it("lists held capacity allocations by shop", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      await repo.allocate({ shop: "capacity-held", key: "staff.max", allocationId: "staff-1", maximum: 1, subscriptionRevision: 1 });
      await env.DB.prepare("UPDATE entitlement_allocations SET state = 'held' WHERE shop = ?").bind("capacity-held").run();
      expect(await repo.listHeldAllocations("capacity-held")).toEqual([{ key: "staff.max", allocationId: "staff-1" }]);
      expect(await repo.listHeldAllocations("other-shop")).toEqual([]);
    });
  });
});
