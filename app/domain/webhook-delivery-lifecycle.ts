import { err, ok, type Result } from "~/lib/result";

export type WebhookTopic =
  | "app/uninstalled"
  | "app/scopes_update"
  | "customers/data_request"
  | "customers/redact"
  | "shop/redact";

/**
 * Per-topic facts the consumer needs before it dispatches. Keyed by the union so adding a topic without
 * stating them fails the build.
 *
 * `requiresShopRecord: false` marks a topic whose whole purpose is to run when the `shops` row is missing or about to
 * go: `shop/redact` purges the shop, so "the shop row is gone" must not make it a no-op (the delivery row is the
 * proof that Shopify asked), and the compliance topics are owed an answer even for a shop this app never recorded.
 */
const WEBHOOK_TOPICS: Readonly<Record<WebhookTopic, Readonly<{ requiresShopRecord: boolean }>>> = {
  "app/uninstalled": { requiresShopRecord: true },
  "app/scopes_update": { requiresShopRecord: true },
  "customers/data_request": { requiresShopRecord: false },
  "customers/redact": { requiresShopRecord: false },
  "shop/redact": { requiresShopRecord: false },
};

export function topicRequiresShopRecord(topic: WebhookTopic): boolean {
  return WEBHOOK_TOPICS[topic].requiresShopRecord;
}

export const WEBHOOK_PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type WebhookDeliveryStatus =
  | "received"
  | "queued"
  | "processing"
  | "processed"
  | "failed"
  | "dead_letter";

export type WebhookTransitionEvent =
  | { readonly type: "queue" }
  | { readonly type: "claim"; readonly now: number; readonly leaseMs: number }
  | { readonly type: "complete"; readonly now: number }
  | { readonly type: "fail"; readonly now: number }
  | { readonly type: "dead_letter"; readonly now: number };

type Transition = Readonly<{ from: WebhookDeliveryStatus; to: WebhookDeliveryStatus }>;
type WebhookTransitionType = WebhookTransitionEvent["type"];

const TRANSITIONS: Readonly<Record<WebhookDeliveryStatus, Readonly<Partial<Record<WebhookTransitionType, WebhookDeliveryStatus>>>>> = {
  received: { queue: "queued", claim: "processing" },
  queued: { claim: "processing" },
  processing: { claim: "processing", complete: "processed", fail: "failed" },
  processed: {},
  failed: { claim: "processing", dead_letter: "dead_letter" },
  dead_letter: {},
};

export function transitionWebhookDelivery(
  state: Readonly<{ status: WebhookDeliveryStatus | string; processingStartedAt: number | null }>,
  event: WebhookTransitionEvent,
): Result<Transition, "illegal_transition" | "lease_active"> {
  if (!isStatus(state.status)) return err("illegal_transition");

  const to = TRANSITIONS[state.status][event.type];
  if (!to) return err("illegal_transition");
  if (event.type === "claim" && state.status === "processing") {
    if (state.processingStartedAt === null) return err("illegal_transition");
    if (event.now - state.processingStartedAt < event.leaseMs) return err("lease_active");
  }
  return ok({ from: state.status, to });
}

function isStatus(value: string): value is WebhookDeliveryStatus {
  return ["received", "queued", "processing", "processed", "failed", "dead_letter"].includes(value);
}

export function isWebhookTopic(value: string): value is WebhookTopic {
  return Object.hasOwn(WEBHOOK_TOPICS, value);
}
