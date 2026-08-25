import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import { parseSubscriptionUpdatePayload } from "~/billing/subscription-event";

/**
 * The app's own paper trail for "who is on what plan, and when did that
 * change" — the internal console reads what this writes (see
 * app/routes/internal/subscriptions.tsx). The merchant-facing billing page
 * does not: it asks Shopify live instead, since it isn't a hot path.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());
  const { shop, topic, payload } = await shopify.authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const parsed = parseSubscriptionUpdatePayload(payload);
  if (!parsed.ok) {
    console.error(`Malformed ${topic} payload for ${shop}`, parsed.reason, parsed.detail);
    return new Response(null, { status: 400 });
  }

  await new SubscriptionEventRepo().record(
    shop,
    crypto.randomUUID(),
    parsed.value,
    Date.now(),
  );

  return new Response(null, { status: 200 });
};
