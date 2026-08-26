import { aiRefusal } from "~/ai/gate";
import type { ModelRole } from "~/ai/roles";
import { currentPlanKeyFor } from "~/billing/current-plan";
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import type { AiCaller, AiFailureReason, AiGate } from "~/ports/ai";
import type { PlanKey } from "~/billing/plans";
import type { SubscriptionStatus } from "~/db/schema";

/** The statuses that mean money is actually flowing. */
const PAYING_STATUSES: ReadonlySet<SubscriptionStatus> = new Set(["ACTIVE", "ACCEPTED"]);

/**
 * The shipped `AiGate`: reads the shop's plan, then asks the pure policy.
 *
 * The plan comes from our OWN `subscription_events` ledger rather than a live
 * `billing.check()`, on purpose. This runs on the path of every AI call, and a
 * Shopify round trip per draft would make the feature slower than typing. The
 * ledger is written by the `app_subscriptions/update` webhook, so it is
 * authoritative within a webhook delivery of the truth — which is the right
 * trade for a gate on a convenience feature.
 *
 * Everything decidable is in `~/ai/gate`; this file only fetches.
 */
export class PlanAiGate implements AiGate {
  constructor(private readonly subscriptions = new SubscriptionEventRepo()) {}

  async refuse(input: {
    caller: AiCaller;
    role: ModelRole;
  }): Promise<AiFailureReason | null> {
    // Our own surfaces never touch the billing tables at all.
    if (input.caller.surface !== "merchant") {
      return aiRefusal({ surface: input.caller.surface, plan: null, role: input.role });
    }

    return aiRefusal({
      surface: "merchant",
      plan: await this.planFor(input.caller.shop),
      role: input.role,
    });
  }

  /** `null` when there is no shop, no live subscription, or the plan is unrecognised. */
  private async planFor(shop: string | null): Promise<PlanKey | null> {
    if (!shop) return null;

    const latest = await this.subscriptions.latestForShop(shop);
    if (!latest) return null;

    // A cancelled or expired subscription is not a plan. Without this a shop
    // keeps AI after they stop paying, which is the whole thing the gate exists
    // to prevent.
    if (!PAYING_STATUSES.has(latest.status)) return null;

    // `currentPlanKeyFor` is the one place a status becomes a plan, so the gate
    // agrees with the billing page the merchant is looking at when they ask why
    // AI is switched off.
    return currentPlanKeyFor({
      kind: "subscribed",
      name: latest.name,
      status: latest.status,
      test: false,
      price: null,
      interval: null,
      trialEndsAt: null,
      periodEnd: latest.shopifyUpdatedAt,
    });
  }
}

/** Never refuses. For a deployment that does not gate AI at all. */
export class OpenAiGate implements AiGate {
  async refuse(): Promise<AiFailureReason | null> {
    return null;
  }
}
