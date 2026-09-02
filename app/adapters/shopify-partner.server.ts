import type { ActiveSubscription, ShopifyPartnerPort } from "~/ports/shopify-partner";
import { parsePartnerEvent } from "./shopify-partner-events";

const activeSubscriptionQuery = `query ActiveSubscription($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    shop { id myshopifyDomain }
    billingPeriod
    cancelAtEndOfCycle
    trialEndsAt
    currentBillingCycle { startTime endTime }
    legacySubscriptionId
    items {
      handle
      description
      price {
        __typename
        active
        currency
        ... on FlatRatePrice { amount }
        ... on TieredPrice { tiersMode tiers { upTo amountPerUnit amount } }
      }
      usage { quantity cost { amount currencyCode } }
    }
    pendingUpdate {
      billingPeriod
      legacySubscriptionId
      items { handle description price { __typename currency ... on FlatRatePrice { amount } ... on TieredPrice { tiersMode tiers { upTo amountPerUnit amount } } } }
    }
  }
}`;

const historicalEventsQuery = `query HistoricalEvents($filter: EventFilterInput!, $cursor: String) {
  events(filter: $filter, first: 250, after: $cursor) {
    edges {
      node {
        id
        occurredAt
        eventType
        shop { id myshopifyDomain }
        ... on Relationship { relationshipState: state }
        ... on SubscriptionStatus {
          subscriptionState: state
          cancelEffectiveOn
          plan { handle billingPeriod }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function graphqlData(value: unknown): Record<string, unknown> {
  const body = object(value);
  const errors = body && Array.isArray(body.errors) ? body.errors : [];
  if (errors.length > 0) {
    const first = object(errors[0]);
    throw new Error(`Partner API GraphQL error: ${first && typeof first.message === "string" ? first.message : "unknown error"}`);
  }
  const data = body && object(body.data);
  if (!data) throw new Error("Partner API returned invalid JSON");
  return data;
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function subscriptionItem(value: unknown): ActiveSubscription["items"][number] {
  const item = object(value) ?? {};
  const price = object(item.price);
  const usage = object(item.usage);
  const cost = usage && object(usage.cost);
  const priceType = string(price?.__typename);
  const tiers = priceType === "TieredPrice" && Array.isArray(price?.tiers) ? price?.tiers.map((tier) => {
    const value = object(tier);
    return { upTo: string(value?.upTo), amountPerUnit: string(value?.amountPerUnit), amount: string(value?.amount) };
  }) : [];
  return {
    handle: string(item.handle),
    description: string(item.description),
    price: priceType === "TieredPrice"
      ? { kind: "tiered", amount: null, currency: string(price?.currency), tiers }
      : price ? { kind: "flat", amount: string(price.amount), currency: string(price.currency) } : null,
    cappedAmount: cost ? { amount: string(cost.amount), currency: string(cost.currencyCode) } : null,
  };
}

function activeSubscription(value: Record<string, unknown>): ActiveSubscription {
  const shop = object(value.shop);
  const cycle = object(value.currentBillingCycle);
  const pending = object(value.pendingUpdate);
  return {
    shop: shop ? { id: string(shop.id), myshopifyDomain: string(shop.myshopifyDomain) } : null,
    billingPeriod: string(value.billingPeriod),
    cancelAtEndOfCycle: value.cancelAtEndOfCycle === true,
    trialEndsAt: string(value.trialEndsAt), legacySubscriptionId: string(value.legacySubscriptionId),
    currentBillingCycle: cycle && string(cycle.startTime) && string(cycle.endTime)
      ? { startTime: string(cycle.startTime)!, endTime: string(cycle.endTime)! } : null,
    items: Array.isArray(value.items) ? value.items.map(subscriptionItem) : [],
    pendingUpdate: pending ? { billingPeriod: string(pending.billingPeriod), legacySubscriptionId: string(pending.legacySubscriptionId), items: Array.isArray(pending.items) ? pending.items.map(subscriptionItem) : [] } : null,
  };
}

export class ShopifyPartnerAdapter implements ShopifyPartnerPort {
  constructor(private readonly dependencies: {
    readonly token: string;
    readonly organizationId: string;
    readonly apiVersion: string;
    readonly fetch: typeof fetch;
  }) {}

  private endpoint(): string {
    const placeholder = /^(?:REPLACE_ME|TODO|CHANGE_ME)$/i;
    if (!this.dependencies.token || !this.dependencies.organizationId || !this.dependencies.apiVersion || placeholder.test(this.dependencies.organizationId) || placeholder.test(this.dependencies.apiVersion)) {
      throw new Error("Partner API organization, version, and token are required");
    }
    return `https://partners.shopify.com/${encodeURIComponent(this.dependencies.organizationId)}/api/${encodeURIComponent(this.dependencies.apiVersion)}/graphql.json`;
  }

  async activeSubscription(appId: string, shopId: string): Promise<ActiveSubscription | null> {
    const response = await this.dependencies.fetch(this.endpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.dependencies.token,
      },
      body: JSON.stringify({ query: activeSubscriptionQuery, variables: { appId, shopId } }),
    });
    if (!response.ok) throw new Error(`Partner API returned HTTP ${response.status}`);
    const data = graphqlData(await response.json());
    if (!("activeSubscription" in data)) {
      throw new Error("Partner API response omitted activeSubscription");
    }
    const subscription = object(data.activeSubscription);
    if (!subscription) return null;
    return activeSubscription(subscription);
  }

  async listHistoricalEvents(input: {
    readonly appId: string;
    readonly shopId?: string;
    readonly cursor?: string | null;
    readonly occurredAtMin?: string;
  }) {
    const filter = {
      subjectType: "APP",
      subjectId: input.appId,
      ...(input.shopId ? { shopId: input.shopId } : {}),
      ...(input.occurredAtMin ? { occurredAtMin: input.occurredAtMin } : {}),
      eventTypes: [
        "RELATIONSHIP_INSTALLED", "RELATIONSHIP_UNINSTALLED", "RELATIONSHIP_DEACTIVATED", "RELATIONSHIP_REACTIVATED",
        "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_CANCELLATION_SCHEDULED", "SUBSCRIPTION_CANCELED",
        "SUBSCRIPTION_FROZEN", "SUBSCRIPTION_UNFROZEN",
      ],
    };
    const response = await this.dependencies.fetch(this.endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": this.dependencies.token },
      body: JSON.stringify({ query: historicalEventsQuery, variables: { filter, cursor: input.cursor ?? null } }),
    });
    if (!response.ok) throw new Error(`Partner API returned HTTP ${response.status}`);
    const events = object(graphqlData(await response.json()).events);
    const edges = events && Array.isArray(events.edges) ? events.edges : null;
    const pageInfo = events && object(events.pageInfo);
    if (!edges || !pageInfo || typeof pageInfo.hasNextPage !== "boolean") {
      throw new Error("Partner API response omitted events pagination");
    }
    return {
      events: edges.map((edge) => {
        const item = object(edge);
        return parsePartnerEvent(item?.node);
      }),
      hasNextPage: pageInfo.hasNextPage,
      endCursor: typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : null,
    };
  }
}
