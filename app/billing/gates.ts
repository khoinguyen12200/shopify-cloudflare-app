import type { EntitlementKey, ResolvedEntitlement } from "~/domain/entitlement-policy";
import type { EntitlementOperationResult } from "~/ports/entitlements";

type Entitlements = {
  check(shop: string, key: EntitlementKey): Promise<ResolvedEntitlement | EntitlementOperationResult>;
  reserve(input: { shop: string; key: EntitlementKey; operationId: string; amount: number }): Promise<ResolvedEntitlement | EntitlementOperationResult>;
  allocate(input: { shop: string; key: EntitlementKey; allocationId: string }): Promise<ResolvedEntitlement | EntitlementOperationResult>;
};
export function createPlanGate(input: { entitlements: Entitlements; key: EntitlementKey }) { return { check: (shop: string) => input.entitlements.check(shop, input.key) }; }
export function createQuotaGate(input: { entitlements: Entitlements; key: EntitlementKey; amount: number }) { return { reserve: (shop: string, operationId: string) => input.entitlements.reserve({ shop, key: input.key, operationId, amount: input.amount }) }; }
export function createCapacityGate(input: { entitlements: Entitlements; key: EntitlementKey; allocationId: string }) { return { allocate: (shop: string) => input.entitlements.allocate({ shop, key: input.key, allocationId: input.allocationId }) }; }
