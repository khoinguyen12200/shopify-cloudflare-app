import type { EntitlementKey, ResolvedEntitlement } from "~/domain/entitlement-policy";
import type { EntitlementOperationResult, ReserveResult, AllocateResult } from "~/ports/entitlements";

type Entitlements = {
  check(shop: string, key: EntitlementKey): Promise<ResolvedEntitlement | EntitlementOperationResult>;
  reserve(input: { shop: string; key: EntitlementKey; operationId: string; amount: number }): Promise<ReserveResult>;
  allocate(input: { shop: string; key: EntitlementKey; allocationId: string; operationId: string }): Promise<AllocateResult>;
  confirmAllocation?(input: { shop: string; key: EntitlementKey; allocationId: string; operationId: string }): Promise<{ allowed: true; allocationId: string; state: "allocated" } | EntitlementOperationResult>;
  deallocate?(input: { shop: string; key: EntitlementKey; allocationId: string; operationId: string }): Promise<EntitlementOperationResult>;
  commit?(input: { shop: string; operationId: string; actualAmount?: number }): Promise<EntitlementOperationResult>;
  release?(input: { shop: string; operationId: string }): Promise<EntitlementOperationResult>;
};
export function createPlanGate(input: { entitlements: Entitlements; key: EntitlementKey }) { return { check: (shop: string) => input.entitlements.check(shop, input.key) }; }
export function createQuotaGate(input: { entitlements: Entitlements; key: EntitlementKey; amount: number }) { return { reserve: (shop: string, operationId: string) => input.entitlements.reserve({ shop, key: input.key, operationId, amount: input.amount }), commit: input.entitlements.commit, release: input.entitlements.release }; }
export function createCapacityGate(input: { entitlements: Entitlements; key: EntitlementKey; allocationId: string }) { return { allocate: (shop: string, operationId: string) => input.entitlements.allocate({ shop, key: input.key, allocationId: input.allocationId, operationId }), confirm: input.entitlements.confirmAllocation, deallocate: input.entitlements.deallocate }; }
