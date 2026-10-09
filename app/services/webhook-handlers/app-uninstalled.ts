import type { WebhookHandler } from "~/services/webhook-consumer";
import { recordUninstall, type RecordUninstallPorts } from "~/services/record-uninstall";

/**
 * `app/uninstalled`: the uninstall happened when Shopify TRIGGERED the webhook, not when the queue got to it, so
 * the delivery's trigger time is the observation. A retried delivery arriving after a reinstall is ignored.
 */
export function appUninstalledHandler(ports: RecordUninstallPorts): WebhookHandler {
  return async (delivery) => {
    await recordUninstall(ports, delivery.shop, { occurredAt: delivery.triggeredAt, externalId: `webhook:${delivery.id}` });
  };
}
