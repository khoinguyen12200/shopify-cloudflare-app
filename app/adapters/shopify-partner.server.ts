import type { ShopifyPartnerPort } from "~/ports/shopify-partner";
import { parsePartnerEvent } from "./shopify-partner-events";

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
    const data = graphqlData(await response.json());
    if (!("activeSubscription" in data)) {
      throw new Error("Partner API response omitted activeSubscription");
    }
    return data.activeSubscription ?? null;
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
    const response = await this.dependencies.fetch(endpoint, {
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
