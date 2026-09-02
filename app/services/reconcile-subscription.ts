import type { ActiveSubscription, ShopifyPartnerPort } from "~/ports/shopify-partner";
import { fromDecimalString } from "~/money";

export interface Clock { readonly now: () => number; }
export interface ShopIdentity { readonly shop: string; readonly shopifyShopId: string | null; }
export interface SubscriptionProjectionPort {
  upsertSubscriptionProjection(shop: string, observation: SubscriptionObservation): Promise<"applied" | "stale" | "duplicate">;
}
export interface SubscriptionObservation {
  readonly type: "ACTIVE_SUBSCRIPTION";
  readonly subscriptionId: string;
  readonly status: "NONE" | "PENDING" | "ACTIVE" | "CANCELLATION_SCHEDULED" | "FROZEN" | "CANCELED" | "UNKNOWN";
  readonly occurredAt: number;
  readonly externalId: string;
  readonly planHandle?: string | null;
  readonly billingInterval?: string | null;
  readonly trialEndsAt?: number | null;
  readonly currentPeriodStartsAt?: number | null;
  readonly currentPeriodEndsAt?: number | null;
  readonly cancellationEffectiveAt?: number | null;
  readonly pendingPlanHandle?: string | null;
  readonly pendingBillingInterval?: string | null;
  readonly pendingLegacySubscriptionId?: string | null;
  readonly items?: readonly {
    readonly itemType: string;
    readonly priceAmount: number | null;
    readonly priceCurrency: string | null;
    readonly cappedAmountAmount?: number | null;
    readonly cappedAmountCurrency?: string | null;
  }[];
}
export type RefreshResult = { readonly status: "refreshed" } | { readonly status: "failed"; readonly code: string; readonly detail: string };

function subscriptionItems(response: ActiveSubscription | null): SubscriptionObservation["items"] {
  if (!response) return [];
  return response.items.flatMap((item) => {
    if (!item.price) throw new Error(`Missing Partner subscription price for ${item.handle ?? "subscription"}`);
    if (item.price.kind === "tiered") throw new Error(`Unsupported Partner tiered price for ${item.handle ?? "subscription"}`);
    const money = item.price.amount && item.price.currency ? fromDecimalString(item.price.amount, item.price.currency) : null;
    const capped = item.cappedAmount && item.cappedAmount.amount && item.cappedAmount.currency
      ? fromDecimalString(item.cappedAmount.amount, item.cappedAmount.currency)
      : null;
    if (!money?.ok || (item.cappedAmount !== null && !capped?.ok)) throw new Error(`Invalid Partner subscription price for ${item.handle ?? "subscription"}`);
    return [{ itemType: item.handle ?? "subscription", priceAmount: money.value.amount, priceCurrency: item.price.currency, cappedAmountAmount: capped?.ok ? capped.value.amount : null, cappedAmountCurrency: capped?.ok ? capped.value.currency : null }];
  });
}

export async function refreshSubscription(deps: {
  readonly partner: ShopifyPartnerPort;
  readonly subscriptions: SubscriptionProjectionPort;
  readonly clock: Clock;
  readonly appId: string | null;
}, shop: ShopIdentity, now: number): Promise<RefreshResult> {
  if (!deps.appId || !shop.shopifyShopId) return { status: "failed", code: "MISSING_CREDENTIALS", detail: "Partner app ID, token, or Shopify shop ID unavailable" };
  try {
    const response = await deps.partner.activeSubscription(deps.appId, shop.shopifyShopId);
    const subscriptionId = response?.legacySubscriptionId ?? `active:${shop.shopifyShopId}`;
    const firstItem = response?.items[0] ?? null;
    const pendingItem = response?.pendingUpdate?.items[0] ?? null;
    const trialEndsAt = response?.trialEndsAt ? Date.parse(response.trialEndsAt) : null;
    const currentPeriodStartsAt = response?.currentBillingCycle ? Date.parse(response.currentBillingCycle.startTime) : null;
    const currentPeriodEndsAt = response?.currentBillingCycle ? Date.parse(response.currentBillingCycle.endTime) : null;
    await deps.subscriptions.upsertSubscriptionProjection(shop.shop, {
      type: "ACTIVE_SUBSCRIPTION",
      subscriptionId,
      status: response === null ? "NONE" : response.cancelAtEndOfCycle ? "CANCELLATION_SCHEDULED" : "ACTIVE",
      occurredAt: now,
      externalId: subscriptionId,
      planHandle: firstItem?.handle ?? null,
      billingInterval: response?.billingPeriod ?? null,
      trialEndsAt: Number.isFinite(trialEndsAt) ? trialEndsAt : null,
      currentPeriodStartsAt: Number.isFinite(currentPeriodStartsAt) ? currentPeriodStartsAt : null,
      currentPeriodEndsAt: Number.isFinite(currentPeriodEndsAt) ? currentPeriodEndsAt : null,
      cancellationEffectiveAt: response?.cancelAtEndOfCycle && Number.isFinite(currentPeriodEndsAt) ? currentPeriodEndsAt : null,
      pendingPlanHandle: pendingItem?.handle ?? null,
      pendingBillingInterval: response?.pendingUpdate?.billingPeriod ?? null,
      pendingLegacySubscriptionId: response?.pendingUpdate?.legacySubscriptionId ?? null,
      items: subscriptionItems(response),
    });
    return { status: "refreshed" };
  } catch (error) {
    return { status: "failed", code: "SUBSCRIPTION_REFRESH_FAILED", detail: error instanceof Error ? error.message : String(error) };
  }
}
