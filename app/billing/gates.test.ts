import { describe, expect, it } from "vitest";
import { createPlanGate, createQuotaGate, createCapacityGate } from "./gates";

const entitlements = {
  check: async () => ({ allowed: true as const, kind: "capability" as const }),
  reserve: async () => ({ allowed: true as const }),
  allocate: async () => ({ allowed: true as const }),
};

describe("entitlement gates", () => {
  it("delegates capability checks", async () => {
    expect(await createPlanGate({ entitlements, key: "x" }).check("shop")).toEqual({ allowed: true, kind: "capability" });
  });
  it("delegates quota reservations", async () => {
    expect(await createQuotaGate({ entitlements, key: "x", amount: 2 }).reserve("shop", "op")).toEqual({ allowed: true });
  });
  it("delegates capacity allocations", async () => {
    expect(await createCapacityGate({ entitlements, key: "x", allocationId: "a" }).allocate("shop")).toEqual({ allowed: true });
  });
});
