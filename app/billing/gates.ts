import type { EntitlementKey } from "~/domain/entitlement-policy";

type Entitlements = {
  check(shop: string, key: EntitlementKey): Promise<unknown>;
  reserve(input: { shop: string; key: EntitlementKey; operationId: string; amount: number }): Promise<unknown>;
  allocate(input: { shop: string; key: EntitlementKey; allocationId: string }): Promise<unknown>;
};
export function createPlanGate(input: { entitlements: Entitlements; key: EntitlementKey }) {
  return { check: (shop: string) => input.entitlements.check(shop, input.key) };
}
export function createQuotaGate(input: { entitlements: Entitlements; key: EntitlementKey; amount: number }) {
  return { reserve: (shop: string, operationId: string) => input.entitlements.reserve({ shop, key: input.key, operationId, amount: input.amount }) };
}
export function createCapacityGate(input: { entitlements: Entitlements; key: EntitlementKey; allocationId: string }) {
  return { allocate: (shop: string) => input.entitlements.allocate({ shop, key: input.key, allocationId: input.allocationId }) };
}
