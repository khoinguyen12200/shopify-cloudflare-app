import type { WebhookDeliveryInput } from "~/models/webhook-deliveries.server";

export interface WebhookIngestDependencies {
  readonly deliveries: {
    claim(input: WebhookDeliveryInput): Promise<"claimed" | "duplicate">;
    get(shop: string, id: string): Promise<{ readonly status: string } | undefined>;
    markQueued(shop: string, id: string): Promise<void>;
  };
  readonly queue: { send(message: WebhookQueueMessage): Promise<unknown> };
  readonly hashPayload: (payload: unknown) => Promise<string>;
  readonly beforeEnqueue?: (webhook: AuthenticatedWebhook) => Promise<void>;
  readonly log?: (webhook: AuthenticatedWebhook, outcome: "queued" | "duplicate", latencyMs: number) => Promise<void>;
}

export interface WebhookQueueMessage {
  readonly shop: string;
  readonly id: string;
}

export interface AuthenticatedWebhook {
  readonly webhookId: string;
  readonly eventId: string;
  readonly topic: string;
  readonly shop: string;
  readonly apiVersion: string;
  readonly triggeredAt: number;
  readonly receivedAt: number;
  readonly payload: unknown;
}

/** Persist before handoff, so a Shopify retry cannot create a second effect. */
export async function ingestWebhook(
  dependencies: WebhookIngestDependencies,
  webhook: AuthenticatedWebhook,
): Promise<"queued" | "duplicate"> {
  const claimed = await dependencies.deliveries.claim({
    id: webhook.webhookId,
    eventId: webhook.eventId,
    topic: webhook.topic,
    shop: webhook.shop,
    apiVersion: webhook.apiVersion,
    triggeredAt: webhook.triggeredAt,
    receivedAt: webhook.receivedAt,
    payloadHash: await dependencies.hashPayload(webhook.payload),
  });
  if (claimed === "duplicate") {
    const existing = await dependencies.deliveries.get(webhook.shop, webhook.webhookId);
    if (existing?.status !== "received") {
      await dependencies.log?.(webhook, "duplicate", Date.now() - webhook.receivedAt);
      return "duplicate";
    }
  }

  await dependencies.beforeEnqueue?.(webhook);
  await dependencies.queue.send({ shop: webhook.shop, id: webhook.webhookId });
  await dependencies.deliveries.markQueued(webhook.shop, webhook.webhookId);
  await dependencies.log?.(webhook, "queued", Date.now() - webhook.receivedAt);
  return "queued";
}

export async function sha256Json(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
