import { eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { entitlementAllocations, entitlementOperations, entitlementUsage } from "./entitlements";
import { setupTestDatabase } from "~/test/db";

setupTestDatabase();

describe("entitlement schema", () => {
  it("defines quota usage and reusable capacity tables", () => {
    expect(entitlementOperations).toBeDefined();
    expect(entitlementUsage).toBeDefined();
    expect(entitlementAllocations).toBeDefined();
  });

  it("protects entitlement amounts and lifecycle states with database checks", () => {
    const operationChecks = getTableConfig(entitlementOperations).checks.map(({ name }) => name);
    const usageChecks = getTableConfig(entitlementUsage).checks.map(({ name }) => name);
    const allocationChecks = getTableConfig(entitlementAllocations).checks.map(({ name }) => name);

    expect(operationChecks).toEqual([
      "entitlement_operations_amounts_check",
      "entitlement_operations_state_check",
    ]);
    expect(usageChecks).toEqual(["entitlement_usage_amounts_check"]);
    expect(allocationChecks).toEqual(["entitlement_allocations_state_check"]);
    expect(getTableConfig(entitlementAllocations).indexes).toHaveLength(2);
  });

  it("rejects amounts above Number.MAX_SAFE_INTEGER at the database boundary", async () => {
    const amount = Number.MAX_SAFE_INTEGER + 1;
    await expect(makeDb(env.DB).insert(schema.entitlementOperations).values({ shop: "limits.myshopify.com", operationId: "op-requested", key: "quota", period: "lifetime", requestedAmount: amount, reservedAmount: 0, actualAmount: null, subscriptionRevision: 0, state: "held", createdAt: 0, updatedAt: 0 }).run()).rejects.toThrow();
    await expect(makeDb(env.DB).insert(schema.entitlementOperations).values({ shop: "limits.myshopify.com", operationId: "op-reserved", key: "quota", period: "lifetime", requestedAmount: 0, reservedAmount: amount, actualAmount: null, subscriptionRevision: 0, state: "held", createdAt: 0, updatedAt: 0 }).run()).rejects.toThrow();
    await expect(makeDb(env.DB).insert(schema.entitlementOperations).values({ shop: "limits.myshopify.com", operationId: "op-actual", key: "quota", period: "lifetime", requestedAmount: 0, reservedAmount: 0, actualAmount: amount, subscriptionRevision: 0, state: "held", createdAt: 0, updatedAt: 0 }).run()).rejects.toThrow();
    await expect(makeDb(env.DB).insert(schema.entitlementUsage).values({ shop: "limits.myshopify.com", key: "quota", period: "committed", committed: amount, held: 0, updatedAt: 0 }).run()).rejects.toThrow();
    await expect(makeDb(env.DB).insert(schema.entitlementUsage).values({ shop: "limits.myshopify.com", key: "quota", period: "held", committed: 0, held: amount, updatedAt: 0 }).run()).rejects.toThrow();
  });

  it("rejects fractional and inconsistent accounting values", async () => {
    await expect(makeDb(env.DB).insert(schema.entitlementUsage).values({ shop: "limits.myshopify.com", key: "quota", period: "fraction", committed: 1.5, held: 0, updatedAt: 0 }).run()).rejects.toThrow();
    await expect(makeDb(env.DB).insert(schema.entitlementOperations).values({ shop: "limits.myshopify.com", operationId: "fraction", key: "quota", period: "lifetime", requestedAmount: 1, reservedAmount: 1, actualAmount: 0.5, subscriptionRevision: 0, state: "held", createdAt: 0, updatedAt: 0 }).run()).rejects.toThrow();
    await expect(makeDb(env.DB).insert(schema.entitlementOperations).values({ shop: "limits.myshopify.com", operationId: "inconsistent", key: "quota", period: "lifetime", requestedAmount: 2, reservedAmount: 1, actualAmount: 2, subscriptionRevision: 0, state: "held", createdAt: 0, updatedAt: 0 }).run()).rejects.toThrow();
  });

  it.each([
    [1.5, 2, null], [2, 1.5, null], [2, 2, 1.5],
    [-1, 0, null], [0, -1, null], [1, 1, -1], [2, 1, 2],
  ])("rejects invalid operation amounts %s/%s/%s", async (requested, reserved, actual) => {
    await expect(makeDb(env.DB).insert(schema.entitlementOperations).values({ shop: "limits.myshopify.com", operationId: "invalid", key: "quota", period: "lifetime", requestedAmount: requested, reservedAmount: reserved, actualAmount: actual, subscriptionRevision: 1, state: "held", createdAt: 0, updatedAt: 0 }).run()).rejects.toMatchObject({ cause: expect.objectContaining({ message: expect.stringContaining("entitlement_operations_amounts_check") }) });
  });

  it.each([[0, 1.5], [1.5, 0], [-1, 0], [0, -1], [Number.MAX_SAFE_INTEGER, 1]])(
    "rejects invalid aggregate %s/%s without changing persisted accounting", async (committed, held) => {
      await makeDb(env.DB).insert(schema.entitlementUsage).values({ shop: "limits.myshopify.com", key: "quota", period: "lifetime", committed: 1, held: 2, updatedAt: 0 }).run();
      await expect(makeDb(env.DB).update(schema.entitlementUsage).set({ committed, held }).where(eq(schema.entitlementUsage.shop, "limits.myshopify.com")).run()).rejects.toMatchObject({ cause: expect.objectContaining({ message: expect.stringContaining("entitlement_usage_amounts_check") }) });
      expect(await makeDb(env.DB).select({ committed: schema.entitlementUsage.committed, held: schema.entitlementUsage.held }).from(schema.entitlementUsage).where(eq(schema.entitlementUsage.shop, "limits.myshopify.com")).get()).toEqual({ committed: 1, held: 2 });
    },
  );

  it.each([0, Number.MAX_SAFE_INTEGER])("preserves valid integer boundary %s", async (amount) => {
    await makeDb(env.DB).insert(schema.entitlementUsage).values({ shop: "limits.myshopify.com", key: "quota", period: "lifetime", committed: amount, held: 0, updatedAt: 0 }).run();
    expect(await makeDb(env.DB).select({ committed: schema.entitlementUsage.committed }).from(schema.entitlementUsage).where(eq(schema.entitlementUsage.shop, "limits.myshopify.com")).get()).toEqual({ committed: amount });
  });
});
