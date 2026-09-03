import type { QueuedWebhook } from "~/ports/webhook-queue";
export type { QueuedWebhook } from "~/ports/webhook-queue";

export interface ConsumerDelivery {
  readonly id: string;
  readonly shop: string;
  readonly topic: string;
  readonly status: string;
}

export interface WebhookConsumerDependencies {
  readonly deliveries: {
    get(shop: string, id: string): Promise<ConsumerDelivery | undefined>;
    markProcessing(shop: string, id: string, startedAt: number): Promise<"claimed" | "unavailable">;
    markProcessed(shop: string, id: string, processedAt: number): Promise<void>;
    markFailed(shop: string, id: string, failure: {
      readonly failedAt: number;
      readonly failureCode: string;
      readonly failureDetail: string;
    }): Promise<void>;
    markDeadLetter?(shop: string, id: string, failedAt: number, detail: string): Promise<void>;
  };
  readonly handlers: Record<string, (delivery: ConsumerDelivery) => Promise<void>>;
  readonly now: () => number;
}

export interface WebhookConsumerResult {
  readonly outcome: "processed" | "unavailable" | "missing" | "duplicate";
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
  if (delivery.status === "processed") return { outcome: "duplicate", topic: delivery.topic };

  const claimed = await dependencies.deliveries.markProcessing(work.shop, work.id, dependencies.now());
  if (claimed === "unavailable") return { outcome: "unavailable", topic: delivery.topic };

  const handler = dependencies.handlers[delivery.topic];
  if (!handler) {
    const detail = `No consumer is registered for ${delivery.topic}.`;
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(),
      failureCode: "unsupported_topic",
      failureDetail: detail,
    });
    if ((work.attempts ?? 0) >= FINAL_QUEUE_ATTEMPT) {
      await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail);
    }
    throw new Error(`Unsupported webhook topic: ${delivery.topic}`);
  }

  try {
    await handler(delivery);
    await dependencies.deliveries.markProcessed(work.shop, work.id, dependencies.now());
    return { outcome: "processed", topic: delivery.topic };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(),
      failureCode: "consumer_failed",
      failureDetail: detail,
    });
    if ((work.attempts ?? 0) >= FINAL_QUEUE_ATTEMPT) {
      await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail);
    }
    throw error;
  }
}
