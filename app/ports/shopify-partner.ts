export interface ShopifyPartnerPort {
  activeSubscription(appId: string, shopId: string): Promise<ActiveSubscription | null>;
  listHistoricalEvents(input: {
    readonly appId: string;
    readonly shopId?: string;
    readonly cursor?: string | null;
    readonly occurredAtMin?: string;
  }): Promise<{ readonly events: PartnerHistoryEvent[]; readonly hasNextPage: boolean; readonly endCursor: string | null }>;
}
export type PartnerHistoryEvent =
  | { readonly kind: "relationship"; readonly id: string; readonly occurredAt: string; readonly shop: string; readonly shopId: string; readonly type: "INSTALLED" | "UNINSTALLED" | "DEACTIVATED" | "REACTIVATED" }
  | { readonly kind: "subscription"; readonly id: string; readonly occurredAt: string; readonly shop: string; readonly shopId: string; readonly type: "CREATED" | "UPDATED" | "CANCELLATION_SCHEDULED" | "CANCELED" | "FROZEN" | "UNFROZEN"; readonly cancelEffectiveOn: string | null; readonly planHandle: string | null; readonly billingPeriod: string | null }
  | { readonly kind: "ignored"; readonly id: string };

export interface ActiveSubscription {
  readonly id?: string;
  readonly legacySubscriptionId?: string;
  readonly status?: string;
  readonly state?: string;
  readonly planHandle?: string;
  readonly billingPeriod?: string;
  readonly trialEndsAt?: string;
  readonly currentPeriodStart?: string;
  readonly currentPeriodEnd?: string;
  readonly pricingItems?: readonly SubscriptionPricingItem[];
  readonly discounts?: readonly SubscriptionDiscount[];
  readonly usage?: { readonly billedAmount: string; readonly billedCurrency: string };
  readonly pendingUpdate?: { readonly status: string; readonly effectiveAt: string | null };
}

export interface SubscriptionPricingItem {
  readonly handle: string | null;
  readonly priceAmount: string | null;
  readonly priceCurrency: string | null;
  readonly cappedAmount: string | null;
  readonly cappedCurrency: string | null;
}

export interface SubscriptionDiscount { readonly amount: string; readonly currency: string; readonly duration: string | null; }
