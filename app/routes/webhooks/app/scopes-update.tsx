import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { scopesUpdatePayloadSchema } from "~/schemas/webhooks";
import { WebhookDeliveryRepo } from "~/models/webhook-deliveries.server";
import { WebhookScopeObservationRepo } from "~/models/webhook-scope-observations.server";
import { ingestWebhook, sha256Json } from "~/services/webhook-ingest";
import { formatWebhookLog, writeWebhookLog } from "~/services/webhook-logging";

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());
  const authenticated = await shopify.authenticate.webhook(request);
  const parsed = scopesUpdatePayloadSchema.safeParse(authenticated.payload);
  if (!parsed.success) throw new Response("Invalid app/scopes_update payload", { status: 400 });

  const now = Date.now();
  await ingestWebhook({
    deliveries: new WebhookDeliveryRepo(),
    queue: getEnv().WEBHOOK_QUEUE,
    hashPayload: sha256Json,
    log: async (webhook, outcome, latencyMs) => writeWebhookLog(await formatWebhookLog({ deliveryId: webhook.webhookId, topic: webhook.topic, shop: webhook.shop, handler: webhook.topic, outcome, attempts: 0, latencyMs })),
    beforeEnqueue: async (webhook) => {
      await new WebhookScopeObservationRepo().record(webhook.webhookId, webhook.shop, parsed.data.current);
    },
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
