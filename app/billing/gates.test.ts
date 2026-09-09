import { describe, expect, it } from "vitest";
import { createPlanGate, createQuotaGate, createCapacityGate } from "./gates";

const entitlements = {
  check: async () => ({ allowed: true as const, kind: "capability" as const }),
  reserve: async () => ({ allowed: true as const, operationId: "op", amount: 2, period: "lifetime", subscriptionRevision: 1, remaining: 0 }),
  allocate: async (input: { operationId: string }) => ({ allowed: true as const, allocationId: "a", operationId: input.operationId, subscriptionRevision: 1, remaining: 0, state: "held" as const }),
};

describe("entitlement gates", () => {
  it("delegates capability checks", async () => {
    expect(await createPlanGate({ entitlements, key: "x" }).check("shop")).toEqual({ allowed: true, kind: "capability" });
  });
  it("delegates quota reservations", async () => {
    expect(await createQuotaGate({ entitlements, key: "x", amount: 2 }).reserve("shop", "op")).toMatchObject({ allowed: true, operationId: "op" });
  });
  it("delegates capacity allocations", async () => {
    expect(await createCapacityGate({ entitlements, key: "x", allocationId: "a" }).allocate("shop", "op")).toMatchObject({ allowed: true, allocationId: "a" });
  });
});
