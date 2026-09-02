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
  const bytes = new TextEncoder().encode(input.shop);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const shopHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
