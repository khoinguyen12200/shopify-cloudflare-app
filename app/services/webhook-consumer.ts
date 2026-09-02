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
  readonly isRedactedShop?: (shop: string) => Promise<boolean>;
  readonly log?: (delivery: ConsumerDelivery, outcome: string, attempts: number, latencyMs: number) => Promise<void>;
}

export interface WebhookConsumerResult {
  readonly outcome: "processed" | "unavailable" | "missing";
  readonly topic: string | null;
}

/** Claim-before-dispatch makes the at-least-once Queue transport exactly-once per delivery. */
export async function consumeWebhook(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
): Promise<WebhookConsumerResult | "redacted"> {
  const delivery = await dependencies.deliveries.get(work.shop, work.id);
  if (!delivery) return { outcome: "missing", topic: null };
  const startedAt = dependencies.now();
  if (await dependencies.isRedactedShop?.(work.shop)) {
    await dependencies.log?.(delivery, "redacted", work.attempts ?? 0, dependencies.now() - startedAt);
    return "redacted";
  }

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
    if ((work.attempts ?? 0) >= 8) {
      await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail);
    }
    throw new Error(`Unsupported webhook topic: ${delivery.topic}`);
  }

  try {
    await handler(delivery);
    await dependencies.deliveries.markProcessed(work.shop, work.id, dependencies.now());
    await dependencies.log?.(delivery, "processed", work.attempts ?? 0, dependencies.now() - startedAt);
    return { outcome: "processed", topic: delivery.topic };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(),
      failureCode: "consumer_failed",
      failureDetail: detail,
    });
    if ((work.attempts ?? 0) >= 8) {
      await dependencies.deliveries.markDeadLetter?.(work.shop, work.id, dependencies.now(), detail);
    }
    await dependencies.log?.(delivery, (work.attempts ?? 0) >= 8 ? "dead_letter" : "failed", work.attempts ?? 0, dependencies.now() - startedAt);
    throw error;
  }
}
