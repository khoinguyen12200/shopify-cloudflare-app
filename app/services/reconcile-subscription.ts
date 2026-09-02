import type { ShopifyPartnerPort } from "~/ports/shopify-partner";

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
}
export type RefreshResult = { readonly status: "refreshed" } | { readonly status: "failed"; readonly code: string; readonly detail: string };

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
}
function string(value: unknown): string | null { return typeof value === "string" && value.length > 0 ? value : null; }
function status(value: unknown): SubscriptionObservation["status"] {
  const candidate = string(value);
  return candidate === "NONE" || candidate === "PENDING" || candidate === "ACTIVE" || candidate === "CANCELLATION_SCHEDULED" || candidate === "FROZEN" || candidate === "CANCELED" || candidate === "UNKNOWN" ? candidate : "ACTIVE";
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
    const data = object(response);
    const subscriptionId = string(data?.id) ?? string(data?.subscriptionId) ?? "active-subscription";
    await deps.subscriptions.upsertSubscriptionProjection(shop.shop, {
      type: "ACTIVE_SUBSCRIPTION",
      subscriptionId,
      status: response === null ? "NONE" : status(data?.status ?? data?.state),
      occurredAt: now,
      externalId: subscriptionId,
      planHandle: string(data?.planHandle),
      billingInterval: string(data?.billingPeriod),
    });
    return { status: "refreshed" };
  } catch (error) {
    return { status: "failed", code: "SUBSCRIPTION_REFRESH_FAILED", detail: error instanceof Error ? error.message : String(error) };
  }
}
