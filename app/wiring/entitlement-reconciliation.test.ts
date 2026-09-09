import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { EntitlementRepo } from "~/models/entitlements.server";
import { runWithRequestContext } from "~/request-context.server";
import { reconcileHeld } from "~/services/entitlement-reconciliation.server";
import { setupTestDatabase } from "~/test/db";
import * as wiring from "~/wiring.server";

setupTestDatabase();

async function seedHeld(shop: string) {
  await env.DB.prepare("INSERT INTO shop_subscriptions (shop,subscription_id,status,applied_occurred_at,applied_external_id,revision) VALUES (?,?,?,?,?,?)")
    .bind(shop, "subscription", "ACTIVE", 1, "event", 1).run();
  expect(await new EntitlementRepo().reserve({ shop, key: "exports", operationId: "quota-1", period: "lifetime", amount: 2, maximum: 2, subscriptionRevision: 1 }))
    .toMatchObject({ allowed: true, state: "held" });
  await env.DB.prepare("INSERT INTO entitlement_allocations (shop,key,allocation_id,operation_id,subscription_revision,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(shop, "staff.max", "staff-1", "capacity-op-1", 1, "held", 1, 1).run();
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
      expect(await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("reconcile-one").first()).toEqual({ committed: 2, held: 0 });
      expect(await env.DB.prepare("SELECT state FROM entitlement_allocations WHERE shop = ?").bind("reconcile-one").first()).toEqual({ state: "allocated" });
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
      expect(await env.DB.prepare("SELECT committed, held FROM entitlement_usage WHERE shop = ?").bind("reconcile-release").first()).toEqual({ committed: 0, held: 0 });
      expect(await new EntitlementRepo().allocate({ shop: "reconcile-release", key: "staff.max", allocationId: "new-resource", operationId: "op-new-resource", maximum: 1, subscriptionRevision: 1 })).toMatchObject({ allowed: true, remaining: 0 });
    });
  });
});
