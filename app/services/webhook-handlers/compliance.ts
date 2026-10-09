import { handleCompliance, type ComplianceDependencies, type ComplianceTopic } from "~/services/compliance.server";
import { shopLog } from "~/observability/shop-log";
import type { WebhookHandler } from "~/services/webhook-consumer";

/**
 * Runs one mandatory compliance topic from the queue consumer instead of inside Shopify's 5 s request window.
 *
 * The HTTP route only verifies, claims and enqueues; the work happens here, where a failure is retried by the queue
 * and the delivery row records it. `compliance.handled` carries the real duration of the work (for `shop/redact`, the
 * purge), which is what to watch against the consumer's CPU and wall limits.
 *
 * The webhook body is not retained (the inbox keeps a hash, never a payload), so the customer topics receive an
 * empty payload. They declare that this app stores no customer data, so nothing in them needs the body. The moment
 * one does, persist the fields it needs in `beforeEnqueue` on the route — the way `app/scopes_update` records its
 * scopes — rather than re-introducing the payload to the inbox.
 */
export function complianceHandler(
  topic: ComplianceTopic,
  dependencies: ComplianceDependencies & { readonly now: () => number },
): WebhookHandler {
  return async (delivery) => {
    const startedAt = dependencies.now();
    await handleCompliance(topic, { shop: delivery.shop, payload: {} }, dependencies);
    await shopLog("compliance.handled", delivery.shop, { topic, durationMs: dependencies.now() - startedAt });
  };
}
