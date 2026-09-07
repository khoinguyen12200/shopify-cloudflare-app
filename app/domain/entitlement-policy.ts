export type UsagePeriod = "lifetime" | "calendar_month" | "billing_period";
import type { SubscriptionStatus } from "./subscription-lifecycle";
export type { SubscriptionStatus } from "./subscription-lifecycle";
export type EntitlementKey = string;
export type FeatureDefinition = { readonly kind: "capability" } | { readonly kind: "capacity" } | { readonly kind: "quota"; readonly period: UsagePeriod };
export type EntitlementGrant = { readonly kind: "disabled" } | { readonly kind: "enabled" } | { readonly kind: "unlimited" } | { readonly kind: "limit"; readonly maximum: number };
export interface EntitlementCatalogue { readonly version: number; readonly freePlan: string; readonly features: Readonly<Record<string, FeatureDefinition>>; readonly plans: Readonly<Record<string, Readonly<Record<string, EntitlementGrant>>>>; }
export interface SubscriptionSnapshot { readonly status: SubscriptionStatus; readonly planHandle: string | null; readonly revision: number; readonly cancellationEffectiveAt?: number; readonly periodStart?: number; readonly periodEnd?: number; }
export type ResolvedEntitlement = { readonly allowed: true; readonly kind: "capability" | "capacity" | "quota"; readonly maximum?: number; readonly period?: UsagePeriod } | { readonly allowed: false; readonly reason: "inactive_subscription" | "unknown_feature" | "unknown_plan" | "invalid_grant" | "disabled" };
function validMaximum(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
export function resolveEntitlement(catalogue: EntitlementCatalogue, subscription: SubscriptionSnapshot, key: EntitlementKey, now: number): ResolvedEntitlement {
  const definition = Object.prototype.hasOwnProperty.call(catalogue.features, key) ? catalogue.features[key] : undefined;
  if (!definition) return { allowed: false, reason: "unknown_feature" };
  const active = subscription.status === "ACTIVE" || (subscription.status === "CANCELLATION_SCHEDULED" && (subscription.cancellationEffectiveAt === undefined || now < subscription.cancellationEffectiveAt));
  if (!active) return { allowed: false, reason: "inactive_subscription" };
  const plan = subscription.planHandle ?? catalogue.freePlan;
  const grants = Object.prototype.hasOwnProperty.call(catalogue.plans, plan) ? catalogue.plans[plan] : undefined;
  if (!grants) return { allowed: false, reason: "unknown_plan" };
  const grant = Object.prototype.hasOwnProperty.call(grants, key) ? grants[key] : undefined;
  if (!grant) return { allowed: false, reason: "unknown_plan" };
  if (grant.kind === "disabled") return { allowed: false, reason: "disabled" };
  if (definition.kind === "capability") return grant.kind === "enabled" || grant.kind === "unlimited" ? { allowed: true, kind: "capability" } : { allowed: false, reason: "invalid_grant" };
  if (grant.kind === "unlimited") return { allowed: true, kind: definition.kind, ...(definition.kind === "quota" ? { period: definition.period } : {}) };
  if (grant.kind !== "limit" || !validMaximum(grant.maximum)) return { allowed: false, reason: "invalid_grant" };
  return { allowed: true, kind: definition.kind, maximum: grant.maximum, ...(definition.kind === "quota" ? { period: definition.period } : {}) };
}
