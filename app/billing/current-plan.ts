import { PLAN_LIST, type PlanKey } from "./plans";
import type { BillingStatus } from "./subscription-status";

/**
 * Which catalogue plan a merchant is on, derived from `billing.check()`'s
 * status. Matched by name — `billing.check()` doesn't expose the Managed
 * Pricing plan handle, only the webhook does (see
 * Managed Pricing subscription history) — against every plan in
 * the catalogue, so adding a plan to `~/billing/plans` is enough; nothing
 * here needs to change.
 *
 * A subscribed name that matches no known plan (renamed or retired on
 * Shopify's side) reads as "free" rather than crashing or guessing.
 */
export function currentPlanKeyFor(status: BillingStatus): PlanKey {
  if (status.kind !== "subscribed") return "free";
  return PLAN_LIST.find((plan) => plan.name === status.name)?.key ?? "free";
}
