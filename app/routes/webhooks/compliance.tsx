import type { ActionFunctionArgs } from "react-router";
import { verifyShopifyWebhook, webhookSecrets } from "~/adapters/shopify-webhook.server";
import { getEnv } from "~/request-context.server";
import { compliancePayloadSchema } from "~/schemas/compliance-webhook";
import { isComplianceTopic } from "~/services/compliance.server";
import { ingestWebhook, parseTriggeredAt, sha256Json } from "~/services/webhook-ingest";
import { formatWebhookLog, withWebhookFailureLog, writeWebhookLog } from "~/services/webhook-logging";
import { webhookDeliveries } from "~/wiring.server";
import { shopLog } from "~/observability/shop-log";

/**
 * The three MANDATORY compliance webhooks share this one endpoint, matching the
 * single `compliance_topics` subscription in shopify.app.toml.
 *
 * Requirements this satisfies
 * (https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance):
 *  • Handles POST with a JSON body.
 *  • An invalid Shopify HMAC header returns 401 Unauthorized —
 *    `verifyShopifyWebhook` throws exactly that Response, so it must NOT be
 *    caught and turned into a 200. Swallowing it would fail app review.
 *  • Returns a 2xx to confirm receipt.
 *
 * Shopify allows 5 s for the whole response and treats anything else as a failed delivery
 * (https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), while the erasure is allowed 30 days. So this
 * route only VERIFIES, CLAIMS and ENQUEUES: the 2xx means the delivery is durable in the inbox and on the queue, and
 * the queue consumer (`webhookConsumer()`, registry in `app/wiring.server.ts`) does the work with retries.
 */
export const action = ({ request }: ActionFunctionArgs) => withWebhookFailureLog(request, () => receive(request));

async function receive(request: Request): Promise<Response> {
  // Throws a 401 Response on a bad HMAC. Deliberately unguarded.
  const authenticated = await verifyShopifyWebhook(request, webhookSecrets(getEnv()));
  const { topic, shop } = authenticated;
  const parsed = compliancePayloadSchema.safeParse(authenticated.payload);
  if (!parsed.success) {
    // Non-2xx on purpose: Shopify retries for 4 hours, during which a too-strict schema can be fixed and redeployed.
    await shopLog("compliance.invalid_payload", shop, { topic });
    return new Response("Invalid compliance payload", { status: 400 });
  }

  if (!isComplianceTopic(topic)) {
    // Unknown topic: acknowledge so Shopify stops retrying, but log it as unhandled rather than reporting it done.
    await shopLog("compliance.unknown_topic", shop, { topic });
    return new Response(null, { status: 204 });
  }

  const now = Date.now();
  const startedAt = now;
  const outcome = await ingestWebhook({
    deliveries: webhookDeliveries(),
    queue: { send: async (message) => { await getEnv().WEBHOOK_QUEUE.send(message); } },
    hashPayload: sha256Json,
    log: async (webhook, result, latencyMs) => writeWebhookLog(await formatWebhookLog({ deliveryId: webhook.webhookId, topic: webhook.topic, shop: webhook.shop, handler: webhook.topic, outcome: result, attempts: 0, latencyMs })),
  }, {
    webhookId: authenticated.webhookId,
    eventId: authenticated.eventId ?? authenticated.webhookId,
    topic,
    shop,
    apiVersion: authenticated.apiVersion,
    triggeredAt: parseTriggeredAt(authenticated.triggeredAt, now),
    receivedAt: now,
    payload: authenticated.payload,
  });

  // The duration to watch against Shopify's 5 s limit is now the enqueue, not the purge.
  await shopLog("compliance.enqueued", shop, { topic, outcome, durationMs: Date.now() - startedAt });
  return new Response(null, { status: 200 });
}

/**
 * Shopify only ever POSTs here. A GET is a misconfiguration (or a probe) — say
 * so with 405 instead of rendering an empty page that looks like success.
 */
export const loader = () => new Response("Method not allowed", { status: 405 });
