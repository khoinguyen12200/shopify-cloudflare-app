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

  it("keeps quota usage isolated by shop and makes replay idempotent", async () => {
    await runWithRequestContext(env, async () => {
      const repo = new EntitlementRepo();
      const input = { shop: "one", key: "exports", operationId: "op-1", period: "lifetime", amount: 3, maximum: 5, subscriptionRevision: 1 };
      expect(await repo.reserve(input)).toMatchObject({ state: "held", remaining: 2 });
      expect(await repo.reserve(input)).toMatchObject({ state: "held" });
      expect(await repo.reserve({ ...input, shop: "two" })).toMatchObject({ state: "held" });
      expect(await repo.reserve({ ...input, operationId: "op-2", amount: 3 })).toEqual({ reason: "limit_exceeded" });
      expect(await repo.commit({ shop: "one", operationId: "op-1", actualAmount: 2 })).toEqual({ state: "committed" });
      const usage = await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("one").first<{ committed: number; held: number }>();
      expect(usage).toEqual({ committed: 2, held: 0 });
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
});
