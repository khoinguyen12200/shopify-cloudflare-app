import { shopLog } from "~/observability/shop-log";
import type { QueuedWebhook } from "~/ports/webhook-queue";
import { decideShopGate, deferralDelaySeconds, type ShopGateDecision, isWebhookTopic, topicRequiresShopRecord, transitionWebhookDelivery, WEBHOOK_PROCESSING_LEASE_MS, type WebhookTopic } from "~/domain/webhook-delivery-lifecycle";
export type { QueuedWebhook } from "~/ports/webhook-queue";

export interface ConsumerDelivery {
  readonly id: string;
  readonly shop: string;
  readonly topic: string;
  readonly status: string;
  /** Epoch ms at which Shopify triggered the webhook (`X-Shopify-Triggered-At`) — what ordering decisions use. */
  readonly triggeredAt: number;
  readonly processingStartedAt?: number | null;
  readonly failureCode?: string | null;
}

export type WebhookHandler = (delivery: ConsumerDelivery) => Promise<void>;
export type WebhookHandlerRegistry = Readonly<Record<WebhookTopic, WebhookHandler>>;

export interface WebhookConsumerDependencies {
  readonly deliveries: {
    get(shop: string, id: string): Promise<ConsumerDelivery | undefined>;
    markProcessing(shop: string, id: string, startedAt: number, expectedFrom?: string, expectedProcessingStartedAt?: number | null): Promise<"claimed" | "unavailable" | "applied" | "conflict">;
    markProcessed(shop: string, id: string, processedAt: number, expectedFrom?: string, expectedProcessingStartedAt?: number | null): Promise<void | "applied" | "conflict">;
    markFailed(shop: string, id: string, failure: {
      readonly failedAt: number;
      readonly failureCode: string;
      readonly failureDetail: string;
    }, expectedFrom?: string, expectedProcessingStartedAt?: number | null): Promise<void | "applied" | "conflict">;
    /** Removes a delivery that was skipped for a redacted shop, so nothing naming the shop lingers. */
    deleteDelivery?(shop: string, id: string): Promise<void>;
    markDeadLetter?(shop: string, id: string, failedAt: number, detail: string, expectedFrom?: string): Promise<void | "applied" | "conflict">;
  };
  readonly handlers: WebhookHandlerRegistry;
  readonly now: () => number;
  /**
   * What is known about a shop: erased (tombstoned) and/or recorded (has a `shops` row). Asked only for topics that
   * need the record. Absent means "known and not erased".
   */
  readonly shopStanding?: (shop: string) => Promise<ShopStanding>;
}

export interface ShopStanding {
  readonly tombstoned: boolean;
  readonly hasShopRecord: boolean;
}

export interface WebhookConsumerResult {
  readonly outcome: "processed" | "unavailable" | "deferred" | "missing" | "duplicate" | "unsupported";
  readonly topic: string | null;
  /** Set with `deferred`: how long the queue should wait before redelivering. */
  readonly retryDelaySeconds?: number;
}

const FINAL_QUEUE_ATTEMPT = 9;

type ClaimResult = { readonly claimed: true; readonly startedAt: number } | { readonly claimed: false };

/** Move a delivery into `processing` under the lease rules; `claimed: false` means another consumer owns it. */
async function claimDelivery(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
  delivery: ConsumerDelivery,
): Promise<ClaimResult> {
  const decision = transitionWebhookDelivery(
    { status: delivery.status, processingStartedAt: delivery.processingStartedAt ?? null },
    { type: "claim", now: dependencies.now(), leaseMs: WEBHOOK_PROCESSING_LEASE_MS },
  );
  if (!decision.ok) return { claimed: false };

  const startedAt = dependencies.now();
  const claimed = await dependencies.deliveries.markProcessing(work.shop, work.id, startedAt, decision.value.from, delivery.processingStartedAt ?? null);
  return claimed === "unavailable" || claimed === "conflict" ? { claimed: false } : { claimed: true, startedAt };
}

/** A topic with no registered handler can never succeed: record it as failed, then dead-letter it. */
async function retireUnsupportedTopic(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
  delivery: ConsumerDelivery,
): Promise<WebhookConsumerResult> {
  const unsupported: WebhookConsumerResult = { outcome: "unsupported", topic: delivery.topic };
  const detail = `No consumer is registered for ${delivery.topic}.`;
  if (delivery.status === "failed") {
    await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail, "failed");
    return unsupported;
  }
  const claim = await claimDelivery(dependencies, work, delivery);
  if (!claim.claimed) return { outcome: "unavailable", topic: delivery.topic };
  await dependencies.deliveries.markFailed(work.shop, work.id, {
    failedAt: dependencies.now(), failureCode: "unsupported_topic", failureDetail: detail,
  }, "processing", claim.startedAt);
  await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail, "failed");
  return unsupported;
}

/** Run the topic's handler and settle the delivery; a failure is recorded and rethrown so the queue retries. */
async function runHandler(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
  delivery: ConsumerDelivery,
  topic: WebhookTopic,
  startedAt: number,
): Promise<WebhookConsumerResult> {
  try {
    await dependencies.handlers[topic](delivery);
    await dependencies.deliveries.markProcessed(work.shop, work.id, dependencies.now(), "processing", startedAt);
    return { outcome: "processed", topic };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(),
      failureCode: "consumer_failed",
      failureDetail: detail,
    }, "processing", startedAt);
    if ((work.attempts ?? 0) >= FINAL_QUEUE_ATTEMPT) {
      await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail, "failed");
    }
    throw error;
  }
}

/** Claim-before-dispatch makes the at-least-once Queue transport exactly-once per delivery. */
export async function consumeWebhook(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
): Promise<WebhookConsumerResult> {
  const delivery = await dependencies.deliveries.get(work.shop, work.id);
  if (!delivery) return { outcome: "missing", topic: null };
  const gate = await shopGate(dependencies, work, delivery);
  if (gate === "discard_redacted") {
    await dependencies.deliveries.deleteDelivery?.(work.shop, work.id);
    return { outcome: "missing", topic: delivery.topic };
  }
  if (delivery.status === "processed") return { outcome: "duplicate", topic: delivery.topic };
  if (delivery.status === "dead_letter" && !isWebhookTopic(delivery.topic)) {
    return { outcome: "unsupported", topic: delivery.topic };
  }
  if (gate === "defer_unknown_shop") {
    return { outcome: "deferred", topic: delivery.topic, retryDelaySeconds: deferralDelaySeconds(work.attempts ?? 1) };
  }

  const topic = delivery.topic;
  if (!isWebhookTopic(topic)) return retireUnsupportedTopic(dependencies, work, delivery);

  const claim = await claimDelivery(dependencies, work, delivery);
  if (!claim.claimed) return { outcome: "unavailable", topic };
  if (gate === "run_unknown_shop") await shopLog("webhook.shop_unknown", work.shop, { topic, deliveryId: delivery.id });
  return runHandler(dependencies, work, delivery, topic, claim.startedAt);
}

/**
 * Topics that exist to run when the shop is gone (the purge, the compliance answers) never pay for the lookup.
 * "Erased" is the tombstone, not a missing `shops` row: a shop can legitimately have no row yet.
 */
async function shopGate(dependencies: WebhookConsumerDependencies, work: QueuedWebhook, delivery: ConsumerDelivery): Promise<ShopGateDecision> {
  const needsRecord = !isWebhookTopic(delivery.topic) || topicRequiresShopRecord(delivery.topic);
  const standing = needsRecord ? await dependencies.shopStanding?.(work.shop) : undefined;
  return decideShopGate({
    topic: delivery.topic,
    tombstoned: standing?.tombstoned ?? false,
    hasShopRecord: standing?.hasShopRecord ?? true,
    finalAttempt: (work.attempts ?? 0) >= FINAL_QUEUE_ATTEMPT,
  });
}
