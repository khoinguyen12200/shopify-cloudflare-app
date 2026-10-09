import type { ShopifyEventsPort, WebhookDeliveryRepositoryPort } from "~/wiring.server";

type SubscriptionEvents = Awaited<ReturnType<ShopifyEventsPort["listSubscriptionEvents"]>>;
type RelationshipEvents = Awaited<ReturnType<ShopifyEventsPort["listRelationshipEvents"]>>;
type Deliveries = Awaited<ReturnType<WebhookDeliveryRepositoryPort["listForShop"]>>;

export interface EventHistoryRow {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly occurredAt: number;
  readonly detail: string;
}

/** Relationship, subscription and webhook records merged into one timeline, newest first. */
export function buildEventHistory(
  relationshipEvents: RelationshipEvents,
  history: SubscriptionEvents,
  deliveries: Deliveries,
): EventHistoryRow[] {
  return [
    ...relationshipEvents.map((event) => ({
      id: `relationship:${event.eventId}`,
      kind: "Relationship",
      status: event.eventType,
      occurredAt: event.occurredAt,
      detail: event.reasonDescription ?? event.reason ?? event.eventId,
    })),
    ...history.map((event) => ({
      id: `subscription:${event.id}`,
      kind: "Subscription",
      status: event.status,
      occurredAt: event.occurredAt,
      detail: event.planHandle ?? event.subscriptionId,
    })),
    ...deliveries.map((delivery) => ({
      id: `webhook:${delivery.id}`,
      kind: `Webhook: ${delivery.topic}`,
      status: delivery.status,
      occurredAt: delivery.receivedAt,
      detail: delivery.failureDetail ?? delivery.id,
    })),
  ].sort((left, right) => right.occurredAt - left.occurredAt);
}
