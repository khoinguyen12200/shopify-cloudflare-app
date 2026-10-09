import type { ActionFunctionArgs } from "react-router";
import { verifyShopifyWebhook, webhookSecrets } from "~/adapters/shopify-webhook.server";
import { getEnv } from "~/request-context.server";
import { webhookDeliveries } from "~/wiring.server";
import { ingestWebhook, parseTriggeredAt, sha256Json } from "~/services/webhook-ingest";
import { formatWebhookLog, withWebhookFailureLog, writeWebhookLog } from "~/services/webhook-logging";

export const action = ({ request }: ActionFunctionArgs) => withWebhookFailureLog(request, () => receive(request));

async function receive(request: Request): Promise<Response> {
  const authenticated = await verifyShopifyWebhook(request, webhookSecrets(getEnv()));
  const now = Date.now();
  await ingestWebhook({
    deliveries: webhookDeliveries(),
    queue: { send: async (message) => { await getEnv().WEBHOOK_QUEUE.send(message); } },
    hashPayload: sha256Json,
    log: async (webhook, outcome, latencyMs) => writeWebhookLog(await formatWebhookLog({ deliveryId: webhook.webhookId, topic: webhook.topic, shop: webhook.shop, handler: webhook.topic, outcome, attempts: 0, latencyMs })),
  }, {
    webhookId: authenticated.webhookId,
    eventId: authenticated.eventId ?? authenticated.webhookId,
    topic: authenticated.topic,
    shop: authenticated.shop,
    apiVersion: authenticated.apiVersion,
    triggeredAt: parseTriggeredAt(authenticated.triggeredAt, now),
    receivedAt: now,
    payload: authenticated.payload,
  });

  return new Response(null, { status: 200 });
}
