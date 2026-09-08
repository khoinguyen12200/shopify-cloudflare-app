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
  });

  it("rejects amounts above Number.MAX_SAFE_INTEGER at the database boundary", async () => {
    const amount = Number.MAX_SAFE_INTEGER + 1;
    await expect(env.DB.prepare("INSERT INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "op-requested", "quota", "lifetime", amount, 0, null, 0, "held", 0, 0).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "op-reserved", "quota", "lifetime", 0, amount, null, 0, "held", 0, 0).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "op-actual", "quota", "lifetime", 0, 0, amount, 0, "held", 0, 0).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO entitlement_usage (shop, key, period, committed, held, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "quota", "committed", amount, 0, 0).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO entitlement_usage (shop, key, period, committed, held, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "quota", "held", 0, amount, 0).run()).rejects.toThrow();
  });

  it("rejects fractional and inconsistent accounting values", async () => {
    await expect(env.DB.prepare("INSERT INTO entitlement_usage (shop,key,period,committed,held,updated_at) VALUES (?,?,?,?,?,?)")
      .bind("limits.myshopify.com", "quota", "fraction", 1.5, 0, 0).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "fraction", "quota", "lifetime", 1, 1, 0.5, 0, "held", 0, 0).run()).rejects.toThrow();
    await expect(env.DB.prepare("INSERT INTO entitlement_operations (shop, operation_id, key, period, requested_amount, reserved_amount, actual_amount, subscription_revision, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("limits.myshopify.com", "inconsistent", "quota", "lifetime", 2, 1, 2, 0, "held", 0, 0).run()).rejects.toThrow();
  });

  it.each([
    [1.5, 2, null], [2, 1.5, null], [2, 2, 1.5],
    [-1, 0, null], [0, -1, null], [1, 1, -1], [2, 1, 2],
  ])("rejects invalid operation amounts %s/%s/%s", async (requested, reserved, actual) => {
    await expect(env.DB.prepare("INSERT INTO entitlement_operations (shop,operation_id,key,period,requested_amount,reserved_amount,actual_amount,subscription_revision,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind("limits.myshopify.com", "invalid", "quota", "lifetime", requested, reserved, actual, 1, "held", 0, 0).run()).rejects.toThrow("entitlement_operations_amounts_check");
  });

  it.each([[0, 1.5], [1.5, 0], [-1, 0], [0, -1], [Number.MAX_SAFE_INTEGER, 1]])(
    "rejects invalid aggregate %s/%s without changing persisted accounting", async (committed, held) => {
      await env.DB.prepare("INSERT INTO entitlement_usage (shop,key,period,committed,held,updated_at) VALUES (?,?,?,?,?,?)")
        .bind("limits.myshopify.com", "quota", "lifetime", 1, 2, 0).run();
      await expect(env.DB.prepare("UPDATE entitlement_usage SET committed=?,held=? WHERE shop=?")
        .bind(committed, held, "limits.myshopify.com").run()).rejects.toThrow("entitlement_usage_amounts_check");
      expect(await env.DB.prepare("SELECT committed,held FROM entitlement_usage WHERE shop=?")
        .bind("limits.myshopify.com").first()).toEqual({ committed: 1, held: 2 });
    },
  );

  it.each([0, Number.MAX_SAFE_INTEGER])("preserves valid integer boundary %s", async (amount) => {
    await env.DB.prepare("INSERT INTO entitlement_usage (shop,key,period,committed,held,updated_at) VALUES (?,?,?,?,?,?)")
      .bind("limits.myshopify.com", "quota", "lifetime", amount, 0, 0).run();
    expect(await env.DB.prepare("SELECT committed FROM entitlement_usage WHERE shop=?")
      .bind("limits.myshopify.com").first()).toEqual({ committed: amount });
  });
});
