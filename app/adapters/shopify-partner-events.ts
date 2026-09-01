const relationshipTypes = {
  RELATIONSHIP_INSTALLED: "INSTALLED",
  RELATIONSHIP_UNINSTALLED: "UNINSTALLED",
  RELATIONSHIP_DEACTIVATED: "DEACTIVATED",
  RELATIONSHIP_REACTIVATED: "REACTIVATED",
} as const;

export type PartnerHistoryEvent =
  | {
      readonly kind: "relationship";
      readonly id: string;
      readonly occurredAt: string;
      readonly shop: string;
      readonly shopId: string;
      readonly type: (typeof relationshipTypes)[keyof typeof relationshipTypes];
    }
  | { readonly kind: "ignored"; readonly id: string };

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

  if (!(eventType in relationshipTypes)) return { kind: "ignored", id };

  const occurredAt = stringField(event, "occurredAt");
  const shop = record(event.shop);
  const shopId = shop && stringField(shop, "id");
  const shopDomain = shop && stringField(shop, "myshopifyDomain");
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
