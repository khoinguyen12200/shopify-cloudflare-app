import { webhookDeliveries } from "~/wiring.server";

/**
 * Put a delivery in the inbox the way `ingestWebhook` leaves it (claimed, then queued), so a consumer test can start
 * from "Shopify's webhook has been accepted". Call inside `runWithRequestContext`.
 */
export async function queuedDelivery(input: { shop: string; id: string; topic: string; triggeredAt: number }): Promise<{ shop: string; id: string }> {
  const repo = webhookDeliveries();
  await repo.claim({
    id: input.id, eventId: `event-${input.id}`, topic: input.topic, apiVersion: "2026-07", shop: input.shop,
    triggeredAt: input.triggeredAt, receivedAt: input.triggeredAt + 1, payloadHash: "a".repeat(64),
  });
  await repo.markQueued(input.shop, input.id);
  return { shop: input.shop, id: input.id };
}
