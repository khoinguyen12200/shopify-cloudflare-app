import { planForShopifyHandle, type PlanHandle } from "./plans";
import type { BillingStatus } from "./subscription-status";

/**
 * Which catalogue plan a merchant is on, derived from `billing.check()`'s
 * status. `billing.check()` doesn't expose the Managed Pricing plan handle;
 * the Partner subscription projection does. The handle is matched against the
 * catalogue, so adding a plan to `~/billing/plans` is enough; nothing here
 * needs to change.
 *
 * A paid subscription with no known handle has no selected catalogue card.
 * Selecting free would falsely tell a subscribed merchant they are on free.
 */
export function currentPlanHandleFor(
  status: BillingStatus,
  planHandle?: string | null,
): PlanHandle | null {
  if (status.kind !== "subscribed") return "free";
  return planForShopifyHandle(planHandle)?.handle ?? null;
}
