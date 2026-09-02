import type { PartnerHistoryEvent } from "~/ports/shopify-partner";

const relationshipTypes = {
  RELATIONSHIP_INSTALLED: "INSTALLED",
  RELATIONSHIP_UNINSTALLED: "UNINSTALLED",
  RELATIONSHIP_DEACTIVATED: "DEACTIVATED",
  RELATIONSHIP_REACTIVATED: "REACTIVATED",
} as const;

export type { PartnerHistoryEvent } from "~/ports/shopify-partner";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;
}

function stringField(value: Record<string, unknown>, key: string): string | null {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : null;
}

export function parsePartnerEvent(value: unknown): PartnerHistoryEvent {
  const event = record(value);
  if (!event) throw new Error("Partner event must be an object");

  const id = stringField(event, "id");
  const eventType = stringField(event, "eventType");
  if (!id || !eventType) throw new Error("Partner event omitted id or eventType");

  const occurredAt = stringField(event, "occurredAt");
  const shop = record(event.shop);
  const shopId = shop && stringField(shop, "id");
  const shopDomain = shop && stringField(shop, "myshopifyDomain");

  if (eventType.startsWith("SUBSCRIPTION_")) {
    const state = stringField(event, "subscriptionState") ?? stringField(event, "state");
    const validState = state === "CREATED" || state === "UPDATED" || state === "CANCELLATION_SCHEDULED"
      || state === "CANCELED" || state === "FROZEN" || state === "UNFROZEN";
    if (!occurredAt || Number.isNaN(Date.parse(occurredAt)) || !shopId || !shopDomain || !state || !validState) {
      throw new Error(`Partner subscription event ${id} omitted valid lifecycle fields`);
    }
    const plan = record(event.plan);
    return {
      kind: "subscription",
      id,
      occurredAt,
      shop: shopDomain,
      shopId,
      type: state,
      cancelEffectiveOn: stringField(event, "cancelEffectiveOn"),
      planHandle: plan && stringField(plan, "handle"),
      billingPeriod: plan && stringField(plan, "billingPeriod"),
    };
  }

  if (!(eventType in relationshipTypes)) return { kind: "ignored", id };

  if (!occurredAt || Number.isNaN(Date.parse(occurredAt)) || !shopId || !shopDomain) {
    throw new Error(`Partner relationship event ${id} omitted valid lifecycle fields`);
  }

  return {
    kind: "relationship",
    id,
    occurredAt,
    shop: shopDomain,
    shopId,
    type: relationshipTypes[eventType === "RELATIONSHIP_INSTALLED"
      ? "RELATIONSHIP_INSTALLED"
      : eventType === "RELATIONSHIP_UNINSTALLED"
        ? "RELATIONSHIP_UNINSTALLED"
        : eventType === "RELATIONSHIP_DEACTIVATED"
          ? "RELATIONSHIP_DEACTIVATED"
          : "RELATIONSHIP_REACTIVATED"],
  };
}
