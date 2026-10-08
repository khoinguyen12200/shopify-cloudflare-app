import type { ActionFunctionArgs } from "react-router";
import { verifyShopifyWebhook } from "~/adapters/shopify-webhook.server";
import { getEnv } from "~/request-context.server";
import { compliancePayloadSchema } from "~/schemas/compliance-webhook";
import { handleCompliance } from "~/services/compliance.server";
import { tenantPurgeDependencies } from "~/wiring.server";
import { shopLog } from "~/observability/shop-log";
import { withWebhookFailureLog } from "~/services/webhook-logging";

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
 */
export const action = ({ request }: ActionFunctionArgs) => withWebhookFailureLog(request, () => receive(request));

async function receive(request: Request): Promise<Response> {
  // Throws a 401 Response on a bad HMAC. Deliberately unguarded.
  const { topic, shop, payload } = await verifyShopifyWebhook(request, getEnv().SHOPIFY_API_SECRET);
  const parsed = compliancePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    await shopLog("compliance.invalid_payload", shop, { topic });
    return new Response("Invalid compliance payload", { status: 400 });
  }

  const startedAt = Date.now();
  const outcome = await handleCompliance(topic, {
    shop,
    payload: parsed.data,
  }, {
    tenantPurge: tenantPurgeDependencies(),
  });

  // Shopify allows 5 s for the whole response (https://shopify.dev/docs/apps/build/webhooks/verify-deliveries). The
  // purge runs inside the request so a 200 means the erasure happened; this duration says when that stops being safe.
  await shopLog("compliance.handled", shop, { topic, durationMs: Date.now() - startedAt });

  if (!outcome) {
    // Unknown topic: acknowledge so Shopify stops retrying, but it is logged as
    // unhandled rather than reported as done.
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 200 });
}

/**
 * Shopify only ever POSTs here. A GET is a misconfiguration (or a probe) — say
 * so with 405 instead of rendering an empty page that looks like success.
 */
export const loader = () => new Response("Method not allowed", { status: 405 });
