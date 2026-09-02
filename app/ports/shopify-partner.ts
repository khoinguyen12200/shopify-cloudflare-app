import type { PartnerHistoryEvent } from "~/adapters/shopify-partner-events";

export interface ShopifyPartnerPort {
  activeSubscription(appId: string, shopId: string): Promise<ActiveSubscription | null>;
  listHistoricalEvents(input: {
    readonly appId: string;
    readonly shopId?: string;
    readonly cursor?: string | null;
    readonly occurredAtMin?: string;
  }): Promise<{ readonly events: PartnerHistoryEvent[]; readonly hasNextPage: boolean; readonly endCursor: string | null }>;
}

export interface ActiveSubscription {
  readonly id?: string;
  readonly status?: string;
  readonly state?: string;
  readonly planHandle?: string;
  readonly billingPeriod?: string;
}
