import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";

export interface EntitlementProjection {
  readonly status: SubscriptionStatus;
  readonly planHandle: string | null;
}

/** Pure policy seam: features opt into a minimum Shopify plan handle later. */
export function canUsePlanFeature(
  projection: EntitlementProjection | undefined,
  requiredPlanHandle: string,
): boolean {
  return (projection?.status === "ACTIVE" || projection?.status === "CANCELLATION_SCHEDULED")
    && projection.planHandle === requiredPlanHandle;
}
