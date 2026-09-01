import type { ShopifyPartnerPort } from "~/ports/shopify-partner";

const endpoint = "https://partners.shopify.com/";

const activeSubscriptionQuery = `query ActiveSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    shop { id myshopifyDomain }
    billingPeriod
    cancelAtEndOfCycle
    trialEndsAt
    items { handle description }
  }
}`;

export class ShopifyPartnerAdapter implements ShopifyPartnerPort {
  constructor(private readonly dependencies: {
    readonly token: string;
    readonly fetch: typeof fetch;
  }) {}

  async activeSubscription(appId: string, shopId: string): Promise<unknown | null> {
    const response = await this.dependencies.fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.dependencies.token,
      },
      body: JSON.stringify({ query: activeSubscriptionQuery, variables: { appId, shopId } }),
    });
    if (!response.ok) throw new Error(`Partner API returned HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("data" in body)) throw new Error("Partner API returned invalid JSON");
    const data = body.data;
    if (!data || typeof data !== "object" || !("activeSubscription" in data)) {
      throw new Error("Partner API response omitted activeSubscription");
    }
    return data.activeSubscription ?? null;
  }
}
