import type { SubscriptionStatus } from "./subscription-lifecycle";
export type { SubscriptionStatus } from "./subscription-lifecycle";

export type UsagePeriod = "lifetime" | "calendar_month" | "billing_period";
export type EntitlementKey = string;
export type UsageWindow =
  | { readonly kind: "lifetime"; readonly key: "lifetime" }
  | { readonly kind: "calendar_month" | "billing_period"; readonly key: string; readonly start: number; readonly end: number };
export type FeatureDefinition = { readonly kind: "capability" } | { readonly kind: "capacity" } | { readonly kind: "quota"; readonly period: UsagePeriod };
export type EntitlementGrant = { readonly kind: "disabled" } | { readonly kind: "enabled" } | { readonly kind: "unlimited" } | { readonly kind: "limit"; readonly maximum: number };
export interface EntitlementCatalogue { readonly version: number; readonly freePlan: string; readonly features: Readonly<Record<string, FeatureDefinition>>; readonly plans: Readonly<Record<string, Readonly<Record<string, EntitlementGrant>>>>; }
export interface SubscriptionSnapshot { readonly status: SubscriptionStatus; readonly planHandle: string | null; readonly revision: number; readonly cancellationEffectiveAt?: number; readonly periodStart?: number; readonly periodEnd?: number; }
export type EntitlementDenialReason = "inactive_subscription" | "unknown_feature" | "unknown_plan" | "invalid_grant" | "invalid_usage_window" | "disabled" | "invalid_catalogue";
export type ResolvedEntitlement =
  | { readonly allowed: true; readonly kind: "capability" }
  | { readonly allowed: true; readonly kind: "capacity"; readonly maximum?: number }
  | { readonly allowed: true; readonly kind: "quota"; readonly maximum?: number; readonly period: UsagePeriod; readonly window: UsageWindow }
  | { readonly allowed: false; readonly reason: EntitlementDenialReason };

export function resolveUsageWindow(period: UsagePeriod, now: number, subscription: SubscriptionSnapshot): UsageWindow | null {
  if (period === "lifetime") return { kind: "lifetime", key: "lifetime" };
  if (period === "calendar_month") {
    const date = new Date(now);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    return { kind: period, key, start: Date.UTC(year, month, 1), end: Date.UTC(year, month + 1, 1) };
  }
  const { periodStart: start, periodEnd: end } = subscription;
  if (start === undefined || end === undefined || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= end || now < start || now >= end) return null;
  return { kind: period, key: `${start}:${end}`, start, end };
}

function own<T>(record: Readonly<Record<string, T>>, key: string): T | undefined { return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined; }
function active(subscription: SubscriptionSnapshot, now: number): boolean {
  return subscription.status === "ACTIVE" || subscription.status === "NONE" || (subscription.status === "CANCELLATION_SCHEDULED" && subscription.cancellationEffectiveAt !== undefined && now < subscription.cancellationEffectiveAt);
}
function validMaximum(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }

export function resolveEntitlement(catalogue: EntitlementCatalogue, subscription: SubscriptionSnapshot, key: EntitlementKey, now: number): ResolvedEntitlement {
  if (catalogue.version !== 1) return { allowed: false, reason: "invalid_catalogue" };
  const definition = own(catalogue.features, key);
  if (!definition) return { allowed: false, reason: "unknown_feature" };
  if (!active(subscription, now)) return { allowed: false, reason: "inactive_subscription" };
  const planHandle = subscription.status === "NONE" ? catalogue.freePlan : subscription.planHandle ?? catalogue.freePlan;
  const grants = own(catalogue.plans, planHandle);
  if (!grants) return { allowed: false, reason: "unknown_plan" };
  const grant = own(grants, key);
  if (!grant) return { allowed: false, reason: "unknown_plan" };
  if (grant.kind === "disabled") return { allowed: false, reason: "disabled" };
  if (definition.kind === "capability") return grant.kind === "enabled" || grant.kind === "unlimited" ? { allowed: true, kind: "capability" } : { allowed: false, reason: "invalid_grant" };
  if (grant.kind !== "unlimited" && (grant.kind !== "limit" || !validMaximum(grant.maximum))) return { allowed: false, reason: "invalid_grant" };
  const maximum = grant.kind === "limit" ? grant.maximum : undefined;
  if (definition.kind === "capacity") return { allowed: true, kind: "capacity", ...(maximum === undefined ? {} : { maximum }) };
  const window = resolveUsageWindow(definition.period, now, subscription);
  if (!window) return { allowed: false, reason: "invalid_usage_window" };
  return { allowed: true, kind: "quota", period: definition.period, window, ...(maximum === undefined ? {} : { maximum }) };
}
