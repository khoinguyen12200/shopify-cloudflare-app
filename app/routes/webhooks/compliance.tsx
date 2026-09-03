import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { handleCompliance } from "~/services/compliance.server";
import { tenantPurgeDependencies } from "~/wiring.server";

/**
 * The three MANDATORY compliance webhooks share this one endpoint, matching the
 * single `compliance_topics` subscription in shopify.app.toml.
 *
 * Requirements this satisfies
 * (https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance):
 *  • Handles POST with a JSON body.
 *  • An invalid Shopify HMAC header returns 401 Unauthorized —
 *    `authenticate.webhook` throws exactly that Response, so it must NOT be
 *    caught and turned into a 200. Swallowing it would fail app review.
 *  • Returns a 2xx to confirm receipt.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());

  // Throws a 401 Response on a bad HMAC. Deliberately unguarded.
  const { topic, shop, payload } = await shopify.authenticate.webhook(request);

  const outcome = await handleCompliance(topic, {
    shop,
    payload: payload as Record<string, unknown>,
  }, {
    tenantPurge: tenantPurgeDependencies(),
  });

  if (!outcome) {
    // Unknown topic: acknowledge so Shopify stops retrying, but it is logged as
    // unhandled rather than reported as done.
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 200 });
};

/**
 * Shopify only ever POSTs here. A GET is a misconfiguration (or a probe) — say
 * so with 405 instead of rendering an empty page that looks like success.
 */
export const loader = () => new Response("Method not allowed", { status: 405 });
