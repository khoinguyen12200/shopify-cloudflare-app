import { webhookScopeObservations } from "~/wiring.server";
import type { ActionFunctionArgs } from "react-router";
import { verifyShopifyWebhook, webhookSecrets } from "~/adapters/shopify-webhook.server";
import { getEnv } from "~/request-context.server";
import { scopesUpdatePayloadSchema } from "~/schemas/webhooks";
import { redactionGuard, webhookDeliveries } from "~/wiring.server";
import { ingestWebhook, parseTriggeredAt, sha256Json } from "~/services/webhook-ingest";
import { formatWebhookLog, withWebhookFailureLog, writeWebhookLog } from "~/services/webhook-logging";

export const action = ({ request }: ActionFunctionArgs) => withWebhookFailureLog(request, () => receive(request));

async function receive(request: Request): Promise<Response> {
  const authenticated = await verifyShopifyWebhook(request, webhookSecrets(getEnv()));
  const parsed = scopesUpdatePayloadSchema.safeParse(authenticated.payload);
  if (!parsed.success) throw new Response("Invalid app/scopes_update payload", { status: 400 });

  const now = Date.now();
  await ingestWebhook({
    deliveries: webhookDeliveries(),
    queue: { send: async (message) => { await getEnv().WEBHOOK_QUEUE.send(message); } },
    now: Date.now,
    hashPayload: sha256Json,
    redaction: redactionGuard(),
    log: async (webhook, outcome, latencyMs) => writeWebhookLog(await formatWebhookLog({ deliveryId: webhook.webhookId, topic: webhook.topic, shop: webhook.shop, handler: webhook.topic, outcome, attempts: 0, latencyMs })),
    beforeEnqueue: async (webhook) => {
      await webhookScopeObservations().record(webhook.webhookId, webhook.shop, parsed.data.current);
    },
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
