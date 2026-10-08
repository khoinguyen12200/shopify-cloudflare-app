import { hashShop } from "~/observability/shop-log";

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

/**
 * Run a webhook entry and record why it failed before the 5xx reaches Shopify. A thrown `Response` (the bad-HMAC
 * 401 from `verifyShopifyWebhook`) is a deliberate answer and passes through unrecorded. Only the error's type and
 * message are logged — never the payload — keyed by the shop hash.
 */
export async function withWebhookFailureLog<T>(request: Request, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Response) throw error;
    const shop = request.headers.get("x-shopify-shop-domain") ?? "";
    console.error(JSON.stringify({
      event: "webhook.entry_failed",
      topic: request.headers.get("x-shopify-topic") ?? "",
      shopHash: shop === "" ? null : await hashShop(shop),
      errorName: error instanceof Error ? error.name : typeof error,
      error: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}

/** A webhook that was handled, or safely ignored, is routine; only a failure belongs at error level. */
export function webhookLogLevel(outcome: string): "log" | "error" {
  return outcome === "processed" || outcome === "duplicate" || outcome === "discarded" || outcome === "unsupported" ? "log" : "error";
}
