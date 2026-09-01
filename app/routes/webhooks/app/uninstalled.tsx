import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { WebhookDeliveryRepo } from "~/models/webhook-deliveries.server";
import { ingestWebhook, sha256Json } from "~/services/webhook-ingest";

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());
  const authenticated = await shopify.authenticate.webhook(request);
  const now = Date.now();
  await ingestWebhook({
    deliveries: new WebhookDeliveryRepo(),
    queue: getEnv().WEBHOOK_QUEUE,
    hashPayload: sha256Json,
  }, {
    webhookId: authenticated.webhookId,
    eventId: authenticated.eventId ?? authenticated.webhookId,
    topic: authenticated.topic,
    shop: authenticated.shop,
    apiVersion: authenticated.apiVersion,
    triggeredAt: authenticated.triggeredAt ? Date.parse(authenticated.triggeredAt) : now,
    receivedAt: now,
    payload: authenticated.payload,
  });

  return new Response(null, { status: 200 });
};
