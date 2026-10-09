// Queue names per deployed environment. One list shared by the consumer router
// and its tests, so the names in wrangler.jsonc are not repeated as literals.

export const WEBHOOK_QUEUE_NAMES = ["shopify-webhooks", "shopify-webhooks-prod"] as const;
export const NOTIFICATION_QUEUE_NAMES = ["notifications", "notifications-prod"] as const;

export type QueueKind = "webhook" | "notification" | "unknown";

/** Which consumer owns a batch. An unrecognised name is `unknown`, never a guess. */
export function queueKind(name: string): QueueKind {
  if (WEBHOOK_QUEUE_NAMES.some((known) => known === name)) return "webhook";
  if (NOTIFICATION_QUEUE_NAMES.some((known) => known === name)) return "notification";
  return "unknown";
}
