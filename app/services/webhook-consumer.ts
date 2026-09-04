import type { QueuedWebhook } from "~/ports/webhook-queue";
import { isWebhookTopic, transitionWebhookDelivery, WEBHOOK_PROCESSING_LEASE_MS, type WebhookTopic } from "~/domain/webhook-delivery-lifecycle";
export type { QueuedWebhook } from "~/ports/webhook-queue";

export interface ConsumerDelivery {
  readonly id: string;
  readonly shop: string;
  readonly topic: string;
  readonly status: string;
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
    markDeadLetter?(shop: string, id: string, failedAt: number, detail: string, expectedFrom?: string): Promise<void | "applied" | "conflict">;
  };
  readonly handlers: WebhookHandlerRegistry;
  readonly now: () => number;
  readonly isRedactedShop?: (shop: string) => Promise<boolean>;
}

export interface WebhookConsumerResult {
  readonly outcome: "processed" | "unavailable" | "missing" | "duplicate" | "unsupported";
  readonly topic: string | null;
}

const FINAL_QUEUE_ATTEMPT = 9;

/** Claim-before-dispatch makes the at-least-once Queue transport exactly-once per delivery. */
export async function consumeWebhook(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
): Promise<WebhookConsumerResult> {
  const delivery = await dependencies.deliveries.get(work.shop, work.id);
  if (!delivery) return { outcome: "missing", topic: null };
  if (await dependencies.isRedactedShop?.(work.shop)) return { outcome: "missing", topic: delivery.topic };
  if (delivery.status === "processed") return { outcome: "duplicate", topic: delivery.topic };
  if (delivery.status === "dead_letter" && delivery.failureCode === "unsupported_topic") {
    return { outcome: "unsupported", topic: delivery.topic };
  }

  if (!isWebhookTopic(delivery.topic)) {
    const detail = `No consumer is registered for ${delivery.topic}.`;
    if (delivery.status === "failed") {
      await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail, "failed");
      return { outcome: "unsupported", topic: delivery.topic };
    }
    const decision = transitionWebhookDelivery(
      { status: delivery.status, processingStartedAt: delivery.processingStartedAt ?? null },
      { type: "claim", now: dependencies.now(), leaseMs: WEBHOOK_PROCESSING_LEASE_MS },
    );
    if (!decision.ok) return { outcome: "unavailable", topic: delivery.topic };
    const startedAt = dependencies.now();
    const claimed = await dependencies.deliveries.markProcessing(work.shop, work.id, startedAt, decision.value.from, delivery.processingStartedAt ?? null);
    if (claimed === "unavailable" || claimed === "conflict") return { outcome: "unavailable", topic: delivery.topic };
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(), failureCode: "unsupported_topic", failureDetail: detail,
    }, "processing", startedAt);
    await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail, "failed");
    return { outcome: "unsupported", topic: delivery.topic };
  }

  const decision = transitionWebhookDelivery(
    { status: delivery.status, processingStartedAt: delivery.processingStartedAt ?? null },
    { type: "claim", now: dependencies.now(), leaseMs: WEBHOOK_PROCESSING_LEASE_MS },
  );
  if (!decision.ok) return { outcome: "unavailable", topic: delivery.topic };

  const startedAt = dependencies.now();
  const claimed = await dependencies.deliveries.markProcessing(work.shop, work.id, startedAt, decision.value.from, delivery.processingStartedAt ?? null);
  if (claimed === "unavailable" || claimed === "conflict") return { outcome: "unavailable", topic: delivery.topic };

  const handler = dependencies.handlers[delivery.topic];

  try {
    await handler(delivery);
    await dependencies.deliveries.markProcessed(work.shop, work.id, dependencies.now(), "processing", startedAt);
    return { outcome: "processed", topic: delivery.topic };
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
