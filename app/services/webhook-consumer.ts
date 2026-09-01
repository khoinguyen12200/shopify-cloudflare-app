export interface QueuedWebhook {
  readonly shop: string;
  readonly id: string;
}

const queuedWebhookSchema = z.object({ shop: z.string().min(1), id: z.string().min(1) });

export function isQueuedWebhook(value: unknown): value is QueuedWebhook {
  return queuedWebhookSchema.safeParse(value).success;
}

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
  };
  readonly handlers: Record<string, (delivery: ConsumerDelivery) => Promise<void>>;
  readonly now: () => number;
}

/** Claim-before-dispatch makes the at-least-once Queue transport exactly-once per delivery. */
export async function consumeWebhook(
  dependencies: WebhookConsumerDependencies,
  work: QueuedWebhook,
): Promise<"processed" | "unavailable" | "missing"> {
  const delivery = await dependencies.deliveries.get(work.shop, work.id);
  if (!delivery) return "missing";

  const claimed = await dependencies.deliveries.markProcessing(work.shop, work.id, dependencies.now());
  if (claimed === "unavailable") return "unavailable";

  const handler = dependencies.handlers[delivery.topic];
  if (!handler) {
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(),
      failureCode: "unsupported_topic",
      failureDetail: `No consumer is registered for ${delivery.topic}.`,
    });
    throw new Error(`Unsupported webhook topic: ${delivery.topic}`);
  }

  try {
    await handler(delivery);
    await dependencies.deliveries.markProcessed(work.shop, work.id, dependencies.now());
    return "processed";
  } catch (error) {
    await dependencies.deliveries.markFailed(work.shop, work.id, {
      failedAt: dependencies.now(),
      failureCode: "consumer_failed",
      failureDetail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
import { z } from "zod";
