import { describe, expect, expectTypeOf, it } from "vitest";
import type { AllocateResult, CheckResult, CommitResult, DeallocateResult, ReleaseResult, ReserveResult } from "~/ports/entitlements";
import { createEntitlements } from "./entitlements.server";

describe("entitlements service", () => {
  it("exposes closed result contracts for every public operation", () => {
    expectTypeOf<CheckResult>().not.toBeAny();
    expectTypeOf<ReserveResult>().not.toBeAny();
    expectTypeOf<CommitResult>().not.toBeAny();
    expectTypeOf<ReleaseResult>().not.toBeAny();
    expectTypeOf<AllocateResult>().not.toBeAny();
    expectTypeOf<DeallocateResult>().not.toBeAny();
  });
  it("checks a capability using the subscription snapshot", async () => {
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 1 }) },
      catalogue: { version: 1, freePlan: "free", features: { x: { kind: "capability" } }, plans: { free: { x: { kind: "enabled" } } } },
      now: () => 0,
    });
    expect(await service.check("shop", "x")).toEqual({ allowed: true, kind: "capability" });
  });

  it("allocates reusable capacity through the capacity port", async () => {
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 7 }) },
      capacity: { allocate: async (input) => ({ allowed: true as const, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, remaining: 0 }), deallocate: async (input) => ({ allowed: true as const, allocationId: input.allocationId, state: "released" as const }) },
      catalogue: { version: 1, freePlan: "free", features: { staff: { kind: "capacity" } }, plans: { free: { staff: { kind: "limit", maximum: 1 } } } },
      now: () => 0,
    });
    expect(await service.allocate({ shop: "shop", key: "staff", allocationId: "user-1" })).toEqual({ allowed: true, allocationId: "user-1", subscriptionRevision: 7, remaining: 0 });
  });

  it("uses the authoritative subscription for capacity writes instead of the preview cache", async () => {
    let allocated = false;
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "FROZEN", planHandle: "free", revision: 8 }) },
      cache: {
        get: async () => ({ status: "ACTIVE", planHandle: "free", revision: 7 }),
        set: async () => undefined,
        invalidate: async () => undefined,
      },
      capacity: {
        allocate: async (input) => { allocated = true; return { allowed: true, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, remaining: 0 }; },
        deallocate: async (input) => ({ allowed: true, allocationId: input.allocationId, state: "released" }),
      },
      catalogue: { version: 1, freePlan: "free", features: { staff: { kind: "capacity" } }, plans: { free: { staff: { kind: "limit", maximum: 1 } } } },
      now: () => 0,
    });
    expect(await service.allocate({ shop: "shop", key: "staff", allocationId: "user-1" })).toEqual({ allowed: false, reason: "inactive_subscription" });
    expect(allocated).toBe(false);
  });

  it("reserves quota with the resolved maximum and period", async () => {
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 3 }) },
      usage: { reserve: async (input) => ({ allowed: true as const, operationId: input.operationId, amount: input.amount, period: input.period, subscriptionRevision: input.subscriptionRevision, remaining: input.maximum - input.amount }), commit: async (input) => ({ allowed: true as const, operationId: input.operationId, state: "committed" as const }), release: async (input) => ({ allowed: true as const, operationId: input.operationId, state: "released" as const }) },
      catalogue: { version: 1, freePlan: "free", features: { exports: { kind: "quota", period: "lifetime" } }, plans: { free: { exports: { kind: "limit", maximum: 1 } } } },
      now: () => 0,
    });
    expect(await service.reserve({ shop: "shop", key: "exports", operationId: "op", amount: 1 })).toEqual({ allowed: true, operationId: "op", amount: 1, period: "lifetime", subscriptionRevision: 3, remaining: 0 });
  });

  it("denies capacity allocation before calling storage when the feature is disabled", async () => {
    let called = false;
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 1 }) },
      capacity: { allocate: async (input) => { called = true; return { allowed: true as const, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, remaining: 0 }; }, deallocate: async (input) => ({ allowed: true as const, allocationId: input.allocationId, state: "released" as const }) },
      catalogue: { version: 1, freePlan: "free", features: { staff: { kind: "capacity" } }, plans: { free: { staff: { kind: "disabled" } } } },
      now: () => 0,
    });
    expect(await service.allocate({ shop: "shop", key: "staff", allocationId: "u" })).toEqual({ allowed: false, reason: "disabled" });
    expect(called).toBe(false);
  });

  it("delegates commit, release, and deallocate lifecycle operations", async () => {
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 1 }) },
      usage: { reserve: async (input) => ({ allowed: true as const, operationId: input.operationId, amount: input.amount, period: input.period, subscriptionRevision: input.subscriptionRevision, remaining: 0 }), commit: async (input) => ({ allowed: true as const, operationId: input.operationId, state: "committed" as const }), release: async (input) => ({ allowed: true as const, operationId: input.operationId, state: "released" as const }) },
      capacity: { allocate: async (input) => ({ allowed: true as const, allocationId: input.allocationId, subscriptionRevision: input.subscriptionRevision, remaining: 0 }), deallocate: async (input) => ({ allowed: true as const, allocationId: input.allocationId, state: "released" as const }) },
      catalogue: { version: 1, freePlan: "free", features: {}, plans: { free: {} } },
    });
    expect(await service.commit({ shop: "shop", operationId: "op", actualAmount: 2 })).toEqual({ allowed: true, operationId: "op", state: "committed" });
    expect(await service.release({ shop: "shop", operationId: "op" })).toEqual({ allowed: true, operationId: "op", state: "released" });
    expect(await service.deallocate({ shop: "shop", key: "staff", allocationId: "u" })).toEqual({ allowed: true, allocationId: "u", state: "released" });
  });

  it("rejects invalid request identifiers before calling storage", async () => {
    let called = false;
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 1 }) },
      usage: { reserve: async (input) => { called = true; return { allowed: true as const, operationId: input.operationId, amount: input.amount, period: input.period, subscriptionRevision: input.subscriptionRevision, remaining: 0 }; }, commit: async (input) => ({ allowed: true as const, operationId: input.operationId, state: "committed" as const }), release: async (input) => ({ allowed: true as const, operationId: input.operationId, state: "released" as const }) },
      catalogue: { version: 1, freePlan: "free", features: { x: { kind: "quota", period: "lifetime" } }, plans: { free: { x: { kind: "limit", maximum: 1 } } } },
    });
    await expect(service.reserve({ shop: "", key: "x", operationId: "op", amount: 1 })).resolves.toEqual({ allowed: false, reason: "invalid_request" });
    expect(called).toBe(false);
  });

  it("rejects an invalid actual amount before committing", async () => {
    let called = false;
    const service = createEntitlements({
      subscriptions: { current: async () => ({ status: "ACTIVE", planHandle: "free", revision: 1 }) },
      usage: { reserve: async (input) => ({ allowed: true, operationId: input.operationId, amount: input.amount, period: input.period, subscriptionRevision: input.subscriptionRevision, remaining: 0 }), commit: async (input) => { called = true; return { allowed: true, operationId: input.operationId, state: "committed" }; }, release: async (input) => ({ allowed: true, operationId: input.operationId, state: "released" }) },
      catalogue: { version: 1, freePlan: "free", features: {}, plans: { free: {} } },
    });
    await expect(service.commit({ shop: "shop", operationId: "op", actualAmount: -1 })).resolves.toEqual({ allowed: false, reason: "invalid_request" });
    expect(called).toBe(false);
  });
});
