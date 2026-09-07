import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { entitlementAllocations, entitlementOperations, entitlementUsage } from "./entitlements";

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
});
