import type { EntitlementKey, SubscriptionSnapshot, UsagePeriod } from "~/domain/entitlement-policy";

export type EntitlementOperationResult =
  | { readonly allowed: true; readonly remaining?: number; readonly allocationId?: string }
  | { readonly allowed: false; readonly reason: "conflict" | "capacity_exhausted" | "not_found" | "invalid_request" };

export interface SubscriptionPort {
  current(shop: string): Promise<SubscriptionSnapshot>;
}

export interface CapacityPort {
  allocate(input: { readonly shop: string; readonly key: EntitlementKey; readonly allocationId: string; readonly maximum: number; readonly subscriptionRevision: number }): Promise<EntitlementOperationResult>;
  deallocate(input: { readonly shop: string; readonly key: EntitlementKey; readonly allocationId: string }): Promise<EntitlementOperationResult>;
}

export interface UsagePort {
  reserve(input: { readonly shop: string; readonly key: EntitlementKey; readonly operationId: string; readonly amount: number; readonly maximum: number; readonly period: UsagePeriod; readonly periodStart?: number; readonly periodEnd?: number; readonly subscriptionRevision: number }): Promise<EntitlementOperationResult>;
  commit(input: { readonly shop: string; readonly operationId: string; readonly actualAmount?: number }): Promise<EntitlementOperationResult>;
  release(input: { readonly shop: string; readonly operationId: string }): Promise<EntitlementOperationResult>;
}

export interface EntitlementCachePort {
  get(shop: string): Promise<SubscriptionSnapshot | null>;
  set(shop: string, snapshot: SubscriptionSnapshot, ttlSeconds: number): Promise<void>;
  invalidate(shop: string): Promise<void>;
}
