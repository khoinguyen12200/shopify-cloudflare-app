import type { EntitlementDenialReason, EntitlementKey, ResolvedEntitlement, SubscriptionSnapshot } from "~/domain/entitlement-policy";

export type OperationDenialReason = EntitlementDenialReason | "operation_conflict" | "conflict" | "quota_exhausted" | "capacity_exhausted" | "not_found" | "invalid_request" | "invalid_amount" | "invalid_state" | "subscription_unavailable";
export type EntitlementOperationFailure = { readonly allowed: false; readonly reason: OperationDenialReason };
export type EntitlementOperationResult = EntitlementOperationFailure;
export type CheckResult = ResolvedEntitlement | EntitlementOperationFailure;
export type PreviewResult = (ResolvedEntitlement | EntitlementOperationFailure) & { readonly authoritative: false };
export type ReserveResult = { readonly allowed: true; readonly operationId: string; readonly amount: number; readonly period: string; readonly subscriptionRevision: number; readonly remaining: number; readonly state?: "held"|"committed"|"released"; readonly replayed?: boolean } | EntitlementOperationFailure;
export type CommitResult = { readonly allowed: true; readonly operationId: string; readonly state: "committed"; readonly replayed?: boolean } | EntitlementOperationFailure;
export type ReleaseResult = { readonly allowed: true; readonly operationId: string; readonly state: "released" | "committed" } | EntitlementOperationFailure;
export type AllocateResult = { readonly allowed: true; readonly allocationId: string; readonly subscriptionRevision: number; readonly remaining: number } | EntitlementOperationFailure;
export type DeallocateResult = { readonly allowed: true; readonly allocationId: string; readonly state: "released" } | EntitlementOperationFailure;

export interface SubscriptionPort { current(shop: string): Promise<SubscriptionSnapshot>; }
export interface CapacityPort {
  allocate(input: { readonly shop: string; readonly key: EntitlementKey; readonly allocationId: string; readonly operationId?: string; readonly maximum: number; readonly subscriptionRevision: number }): Promise<AllocateResult>;
  confirmAllocation?(input: { readonly shop: string; readonly key: EntitlementKey; readonly allocationId: string; readonly operationId?: string }): Promise<DeallocateResult>;
  deallocate(input: { readonly shop: string; readonly key: EntitlementKey; readonly allocationId: string }): Promise<DeallocateResult>;
}
export interface UsagePort {
  reserve(input: { readonly shop: string; readonly key: EntitlementKey; readonly operationId: string; readonly amount: number; readonly maximum: number; readonly period: string; readonly periodStart?: number; readonly periodEnd?: number; readonly subscriptionRevision: number }): Promise<ReserveResult>;
  commit(input: { readonly shop: string; readonly operationId: string; readonly actualAmount?: number }): Promise<CommitResult>;
  release(input: { readonly shop: string; readonly operationId: string }): Promise<ReleaseResult>;
}
export interface HeldUsagePort { listHeld(shop: string): Promise<readonly { readonly operationId: string; readonly key: string; readonly period: string; readonly amount: number }[]>; }
export interface HeldCapacityPort { listHeldAllocations(shop: string): Promise<readonly { readonly key: string; readonly allocationId: string }[]>; }
export interface EntitlementCachePort {
  get(shop: string): Promise<SubscriptionSnapshot | null>;
  set(shop: string, snapshot: SubscriptionSnapshot, ttlSeconds: number): Promise<void>;
  invalidate(shop: string): Promise<void>;
}
