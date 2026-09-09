export type HeldItem = { readonly kind: "quota" | "capacity"; readonly id: string; readonly key: string; readonly shop: string; readonly period?: string; readonly amount?: number; readonly operationId?: string };
export type HeldDecision = "commit" | "release" | "confirm" | "ignore";
export type ReconciliationResult = { readonly state: "committed" | "allocated" | "released" } | { readonly reason: "not_found" | "invalid_state" | "invalid_request" | "invalid_decision" };
export interface HeldReconciliationPort {
  listHeld(shop: string): Promise<readonly HeldItem[]>;
  apply(shop: string, item: HeldItem, decision: Exclude<HeldDecision, "ignore">): Promise<ReconciliationResult>;
}
