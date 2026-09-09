export type HeldItem = {
  readonly kind: "quota" | "capacity";
  readonly id: string;
  readonly key: string;
  readonly shop: string;
  readonly period?: string;
  readonly amount?: number;
  readonly operationId?: string;
  readonly createdAt: number;
};
export type HeldDecision =
  | "commit"
  | "release"
  | "confirm"
  | "ignore"
  | { readonly action: "commit"; readonly actualAmount?: number };
export type ReconciliationResult = { readonly state: "committed" | "allocated" | "released" } | { readonly reason: "not_found" | "invalid_state" | "invalid_request" | "invalid_decision" };
export type HeldCursor = string | undefined;
export type HeldPage = { readonly items: readonly HeldItem[]; readonly nextCursor?: string };
export interface HeldReconciliationPort {
  listHeld(shop: string, cursor?: HeldCursor, limit?: number): Promise<HeldPage>;
  apply(shop: string, item: HeldItem, decision: "commit" | "release" | "confirm", actualAmount?: number): Promise<ReconciliationResult>;
}
