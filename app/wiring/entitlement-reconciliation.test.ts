import { eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { EntitlementRepo } from "~/models/entitlements.server";
import { runWithRequestContext } from "~/request-context.server";
import { reconcileHeld } from "~/services/entitlement-reconciliation.server";
import { setupTestDatabase } from "~/test/db";
import * as wiring from "~/wiring.server";

setupTestDatabase();

async function seedHeld(shop: string) {
  await makeDb(env.DB).insert(schema.shopSubscriptions).values({ shop: shop, subscriptionId: "subscription", status: "ACTIVE", appliedOccurredAt: 1, appliedExternalId: "event", revision: 1 }).run();
  expect(await new EntitlementRepo().reserve({ shop, key: "exports", operationId: "quota-1", period: "lifetime", amount: 2, maximum: 2, subscriptionRevision: 1 }))
    .toMatchObject({ allowed: true, state: "held" });
  await makeDb(env.DB).insert(schema.entitlementAllocations).values({ shop: shop, key: "staff.max", allocationId: "staff-1", operationId: "capacity-op-1", subscriptionRevision: 1, state: "held", createdAt: 1, updatedAt: 1 }).run();
}

describe("wired entitlement reconciliation", () => {
  it("lists and confirms held quota and capacity without touching another shop", async () => {
    await runWithRequestContext(env, async () => {
      await seedHeld("reconcile-one");
      await seedHeld("reconcile-two");
      expect(typeof wiring.entitlementReconciliationPort).toBe("function");
      const port = wiring.entitlementReconciliationPort();
      const held = await port.listHeld("reconcile-one");
      expect(held.items).toMatchObject([
        { kind: "capacity", shop: "reconcile-one", key: "staff.max", id: "staff-1", operationId: "capacity-op-1" },
        { kind: "quota", shop: "reconcile-one", key: "exports", id: "quota-1", period: "lifetime", amount: 2 },
      ]);
      expect(await reconcileHeld("reconcile-one", port, (item) => item.kind === "quota" ? "commit" : "confirm")).toEqual({
        processed: 2, committed: 1, allocated: 1, released: 0, failures: [],
      });
      expect((await port.listHeld("reconcile-one")).items).toEqual([]);
      expect((await port.listHeld("reconcile-two")).items).toHaveLength(2);
      for (const item of held.items) {
        expect(await port.apply("reconcile-one", item, item.kind === "quota" ? "commit" : "confirm")).toEqual({ state: item.kind === "quota" ? "committed" : "allocated" });
      }
      expect(await makeDb(env.DB).select({ committed: schema.entitlementUsage.committed, held: schema.entitlementUsage.held }).from(schema.entitlementUsage).where(eq(schema.entitlementUsage.shop, "reconcile-one")).get()).toEqual({ committed: 2, held: 0 });
      expect(await makeDb(env.DB).select({ state: schema.entitlementAllocations.state }).from(schema.entitlementAllocations).where(eq(schema.entitlementAllocations.shop, "reconcile-one")).get()).toEqual({ state: "allocated" });
    });
  });

  it("resumes deterministic held-item pagination from its cursor", async () => {
    await runWithRequestContext(env, async () => {
      await seedHeld("reconcile-page");
      const port = wiring.entitlementReconciliationPort();

      const first = await port.listHeld("reconcile-page", undefined, 1);
      expect(first.items).toHaveLength(1);
      expect(first.nextCursor).toBeDefined();

      const second = await port.listHeld("reconcile-page", first.nextCursor, 1);
      expect(second.items).toHaveLength(1);
      expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
      expect(second.nextCursor).toBeUndefined();
    });
  });

  it("returns no items for a malformed continuation cursor", async () => {
    await runWithRequestContext(env, async () => {
      await seedHeld("reconcile-invalid-cursor");
      const port = wiring.entitlementReconciliationPort();

      await expect(port.listHeld("reconcile-invalid-cursor", "not-a-cursor", 1)).resolves.toEqual({
        items: [],
        nextCursor: undefined,
      });
    });
  });

  it("releases both kinds idempotently and never revives released capacity", async () => {
    await runWithRequestContext(env, async () => {
      await seedHeld("reconcile-release");
      expect(typeof wiring.entitlementReconciliationPort).toBe("function");
      const port = wiring.entitlementReconciliationPort();
      const held = await port.listHeld("reconcile-release");
      for (const item of held.items) {
        const decision = item.kind === "quota" ? "release" : "release";
        expect(await port.apply("wrong-shop", item, decision)).toEqual({ reason: "invalid_request" });
        expect(await port.apply(item.shop, item, decision)).toEqual({ state: "released" });
        expect(await port.apply(item.shop, item, decision)).toEqual({ state: "released" });
        expect(await port.apply(item.shop, item, item.kind === "quota" ? "commit" : "confirm")).toEqual({ reason: "invalid_state" });
      }
      expect((await port.listHeld("reconcile-release")).items).toEqual([]);
      expect(await makeDb(env.DB).select({ committed: schema.entitlementUsage.committed, held: schema.entitlementUsage.held }).from(schema.entitlementUsage).where(eq(schema.entitlementUsage.shop, "reconcile-release")).get()).toEqual({ committed: 0, held: 0 });
      expect(await new EntitlementRepo().allocate({ shop: "reconcile-release", key: "staff.max", allocationId: "new-resource", operationId: "op-new-resource", maximum: 1, subscriptionRevision: 1 })).toMatchObject({ allowed: true, remaining: 0 });
    });
  });
});
