import type { Plan, PlanHandle } from "~/billing/plans";
import type { SubscriptionStatus } from "~/domain/subscription-lifecycle";

export interface ActivePromoGrant {
  readonly planHandle: string;
  readonly startsAt: number;
  readonly expiresAt: number;
  readonly revokedAt: number | null;
}

export interface EffectivePlanResult {
  readonly planHandle: PlanHandle;
  readonly source: "organic" | "promo";
  readonly activePromo: {
    readonly planHandle: PlanHandle;
    readonly expiresAt: number;
    readonly remainingDays: number;
  } | null;
}

export function isPromoGrantActive(
  grant: ActivePromoGrant | null | undefined,
  now: number = Date.now(),
): grant is ActivePromoGrant {
  if (!grant) return false;
  return grant.revokedAt === null && now >= grant.startsAt && now < grant.expiresAt;
}

export function resolveEffectivePlan(
  organicPlan: string | null | undefined,
  organicStatus: SubscriptionStatus | null | undefined,
  promoGrant: ActivePromoGrant | null | undefined,
  planList: readonly Plan[],
  now: number = Date.now(),
): EffectivePlanResult {
  const isOrganicActive =
    organicStatus === "ACTIVE" || organicStatus === "CANCELLATION_SCHEDULED";

  const freePlan = planList.find((p) => p.priceMonthly.amount === 0) ?? planList[0];
  const matchedOrganic = isOrganicActive && organicPlan
    ? planList.find((p) => p.handle === organicPlan) ?? freePlan
    : freePlan;

  const validPromo = isPromoGrantActive(promoGrant, now) ? promoGrant : null;
  const matchedPromo = validPromo
    ? planList.find((p) => p.handle === validPromo.planHandle) ?? null
    : null;

  if (!matchedPromo) {
    return {
      planHandle: matchedOrganic.handle,
      source: "organic",
      activePromo: null,
    };
  }

  const organicRank = planList.findIndex((p) => p.handle === matchedOrganic.handle);
  const promoRank = planList.findIndex((p) => p.handle === matchedPromo.handle);

  const promoInfo = {
    planHandle: matchedPromo.handle,
    expiresAt: validPromo!.expiresAt,
    remainingDays: Math.max(0, Math.ceil((validPromo!.expiresAt - now) / 86_400_000)),
  };

  if (organicRank >= promoRank) {
    return {
      planHandle: matchedOrganic.handle,
      source: "organic",
      activePromo: promoInfo,
    };
  }

  return {
    planHandle: matchedPromo.handle,
    source: "promo",
    activePromo: promoInfo,
  };
}
