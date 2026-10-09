import type { WebhookDeliveriesPort } from "~/ports/webhook-deliveries";
import type { RedactionGuard } from "~/services/redaction-guard";

export interface WebhookIngestDependencies {
  readonly deliveries: WebhookDeliveriesPort;
  readonly queue: { send(message: WebhookQueueMessage): Promise<void> };
  /** Epoch milliseconds; the log reports latency as `now() - receivedAt`. */
  readonly now: () => number;
  readonly hashPayload: (payload: unknown) => Promise<string>;
  /** A redacted shop's deliveries are acknowledged and dropped: no delivery row may carry its domain again. */
  readonly redaction: Pick<RedactionGuard, "isSuppressed">;
  readonly beforeEnqueue?: (webhook: AuthenticatedWebhook) => Promise<void>;
  readonly log?: (webhook: AuthenticatedWebhook, outcome: "queued" | "duplicate" | "suppressed", latencyMs: number) => Promise<void>;
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
): Promise<"queued" | "duplicate" | "suppressed"> {
  // Before any write. The caller still answers 2xx so Shopify stops retrying; a duplicate or late `shop/redact`
  // for an already-redacted shop is therefore acknowledged and is a no-op that leaves no delivery row behind.
  if (await dependencies.redaction.isSuppressed(webhook.shop, "webhook_delivery")) {
    await dependencies.log?.(webhook, "suppressed", dependencies.now() - webhook.receivedAt);
    return "suppressed";
  }
  const topic = normalizeWebhookTopic(webhook.topic);
  const claimed = await dependencies.deliveries.claim({
    id: webhook.webhookId,
    eventId: webhook.eventId,
    topic,
    shop: webhook.shop,
    apiVersion: webhook.apiVersion,
    triggeredAt: webhook.triggeredAt,
    receivedAt: webhook.receivedAt,
    payloadHash: await dependencies.hashPayload(webhook.payload),
  });
  if (claimed === "duplicate") {
    const existing = await dependencies.deliveries.get(webhook.shop, webhook.webhookId);
    if (existing?.status !== "received") {
      await dependencies.log?.(webhook, "duplicate", dependencies.now() - webhook.receivedAt);
      return "duplicate";
    }
  }

  if (dependencies.deliveries.claimForQueue && !(await dependencies.deliveries.claimForQueue(webhook.shop, webhook.webhookId))) return "duplicate";

  try {
    await dependencies.beforeEnqueue?.(webhook);
    await dependencies.queue.send({ shop: webhook.shop, id: webhook.webhookId });
  } catch (error) {
    await dependencies.deliveries.markReceived?.(webhook.shop, webhook.webhookId);
    throw error;
  }
  await dependencies.deliveries.markQueued(webhook.shop, webhook.webhookId);
  await dependencies.log?.(webhook, "queued", dependencies.now() - webhook.receivedAt);
  return "queued";
}

/** Shopify authentication returns enum names; consumers use webhook paths. */
function normalizeWebhookTopic(topic: string): string {
  if (topic.includes("/")) return topic.toLowerCase();
  const separator = topic.indexOf("_");
  return separator < 0
    ? topic.toLowerCase()
    : `${topic.slice(0, separator).toLowerCase()}/${topic.slice(separator + 1).toLowerCase()}`;
}

/**
 * Epoch ms of `X-Shopify-Triggered-At`, which ordering decisions compare against. A missing or unparseable header
 * falls back to receipt time rather than storing NaN, which would compare as neither older nor newer than anything.
 */
export function parseTriggeredAt(header: string | null, receivedAt: number): number {
  const parsed = header === null ? Number.NaN : Date.parse(header);
  return Number.isFinite(parsed) ? parsed : receivedAt;
}

export async function sha256Json(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
