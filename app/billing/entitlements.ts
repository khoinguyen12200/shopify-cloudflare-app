import { planForShopifyHandle, type Entitlement, type EntitlementKey } from "./plans";
export type { Entitlement, EntitlementKey } from "./plans";
export type PlanEntitlements = Readonly<Record<EntitlementKey, Entitlement>>;

const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  "ai.reply_draft": { kind: "disabled" },
  "ai.monthly_tokens": { kind: "disabled" },
  "projects.max": { kind: "disabled" },
};

const ENTITLEMENT_KEYS: readonly EntitlementKey[] = ["ai.reply_draft", "ai.monthly_tokens", "projects.max"];

export function entitlementFor(planHandle: string | null | undefined, key: string): Entitlement {
  const plan = planForShopifyHandle(planHandle);
  const known = ENTITLEMENT_KEYS.find((candidate) => candidate === key);
  if (!plan || !known) return { kind: "disabled" };
  return plan.entitlements[known] ?? { kind: "disabled" };
}

export function entitlementsFor(planHandle: string | null | undefined): PlanEntitlements {
  const plan = planForShopifyHandle(planHandle);
  return plan ? plan.entitlements : DEFAULT_ENTITLEMENTS;
}
