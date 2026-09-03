export interface ShopifyPartnerPort {
  activeSubscription(appId: string, shopId: string): Promise<ActiveSubscription | null>;
  listHistoricalEvents(input: {
    readonly appId: string;
    readonly shopId?: string;
    readonly cursor?: string | null;
    readonly occurredAtMin?: string;
    readonly occurredAtMax?: string;
  }): Promise<{ readonly events: PartnerHistoryEvent[]; readonly hasNextPage: boolean; readonly endCursor: string | null }>;
}

export type PartnerHistoryEvent =
  | { readonly kind: "relationship"; readonly id: string; readonly occurredAt: string; readonly shop: string; readonly shopId: string; readonly type: "INSTALLED" | "UNINSTALLED" | "DEACTIVATED" | "REACTIVATED" }
  | { readonly kind: "subscription"; readonly id: string; readonly occurredAt: string; readonly shop: string; readonly shopId: string; readonly type: "CREATED" | "UPDATED" | "CANCELLATION_SCHEDULED" | "CANCELED" | "FROZEN" | "UNFROZEN"; readonly cancelEffectiveOn: string | null; readonly planHandle: string | null; readonly billingPeriod: string | null }
  | { readonly kind: "ignored"; readonly id: string };

export interface ActiveSubscription {
  readonly shop: { readonly id: string | null; readonly myshopifyDomain: string | null } | null;
  readonly billingPeriod: string | null;
  readonly cancelAtEndOfCycle: boolean;
  readonly trialEndsAt: string | null;
  readonly currentBillingCycle: { readonly startTime: string; readonly endTime: string } | null;
  readonly legacySubscriptionId: string | null;
  readonly items: readonly PartnerSubscriptionItem[];
  readonly pendingUpdate: { readonly billingPeriod: string | null; readonly legacySubscriptionId: string | null; readonly items: readonly PartnerSubscriptionItem[] } | null;
}

export interface PartnerSubscriptionItem {
  readonly handle: string | null;
  readonly description: string | null;
  readonly price: PartnerPrice | null;
  readonly cappedAmount: { readonly amount: string | null; readonly currency: string | null } | null;
}

export type PartnerPrice =
  | { readonly kind: "flat"; readonly amount: string | null; readonly currency: string | null }
  | { readonly kind: "tiered"; readonly amount: null; readonly currency: string | null; readonly tiers: readonly { readonly upTo: string | null; readonly amountPerUnit: string | null; readonly amount: string | null }[] };
