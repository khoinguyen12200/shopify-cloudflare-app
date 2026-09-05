export interface WebhookLogInput {
  readonly deliveryId: string;
  readonly topic: string;
  readonly shop: string;
  readonly handler: string;
  readonly outcome: string;
  readonly attempts: number;
  readonly latencyMs: number;
}

export function writeWebhookLog(log: Record<string, string | number>): void {
  console.log(JSON.stringify(log));
}

export async function formatWebhookLog(input: WebhookLogInput): Promise<Record<string, string | number>> {
  const shopHash = await hashShop(input.shop);
  return {
    event: "webhook.process",
    deliveryId: input.deliveryId,
    topic: input.topic,
    shopHash,
    handler: input.handler,
    outcome: input.outcome,
    attempts: input.attempts,
    latencyMs: input.latencyMs,
  };
}
import { hashShop } from "~/observability/shop-log";
