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
});
