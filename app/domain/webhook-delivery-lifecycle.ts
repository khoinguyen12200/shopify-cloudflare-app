import { err, ok, type Result } from "~/lib/result";

export type WebhookTopic =
  | "app/uninstalled"
  | "app/scopes_update"
  | "customers/data_request"
  | "customers/redact"
  | "shop/redact";

/** What the consumer does with a topic that needs a shop record when the shop has neither a row nor a tombstone. */
type UnknownShopPolicy = "run" | "defer";

/**
 * Per-topic facts the consumer needs before it dispatches. Keyed by the union so adding a topic without
 * stating them fails the build.
 *
 * `requiresShopRecord: false` marks a topic whose whole purpose is to run when the `shops` row is missing or about to
 * go: `shop/redact` purges the shop, so "the shop row is gone" must not make it a no-op (the delivery row is the
 * proof that Shopify asked), and the compliance topics are owed an answer even for a shop this app never recorded.
 *
 * `onUnknownShop` is OUR policy (not Shopify's) for a topic that needs the row when the shop is not tombstoned and has
 * no row yet - a webhook can overtake the first embedded load that creates it. `run`: the handler's own ordering
 * decision is a correct no-op (an uninstall of a shop never recorded has nothing to undo, and a row created later is
 * newer than it). `defer`: dropping it would lose a fact the row will want (the complete scope set), so it is retried
 * until the row exists or the attempts run out.
 */
const WEBHOOK_TOPICS: Readonly<Record<WebhookTopic, Readonly<{ requiresShopRecord: boolean; onUnknownShop: UnknownShopPolicy }>>> = {
  "app/uninstalled": { requiresShopRecord: true, onUnknownShop: "run" },
  "app/scopes_update": { requiresShopRecord: true, onUnknownShop: "defer" },
  "customers/data_request": { requiresShopRecord: false, onUnknownShop: "run" },
  "customers/redact": { requiresShopRecord: false, onUnknownShop: "run" },
  "shop/redact": { requiresShopRecord: false, onUnknownShop: "run" },
};

export function topicRequiresShopRecord(topic: WebhookTopic): boolean {
  return WEBHOOK_TOPICS[topic].requiresShopRecord;
}

export type ShopGateDecision =
  /** Dispatch normally. */
  | "run"
  /** The shop is erased: drop the delivery and its row so nothing naming the shop lingers. */
  | "discard_redacted"
  /** Dispatch, but the shop is unknown: the consumer logs `webhook.shop_unknown`. */
  | "run_unknown_shop"
  /** Leave the delivery queued and retry later: the shop row may still be coming. */
  | "defer_unknown_shop";

/**
 * Pure: may this delivery run, given what is known about its shop? "Redacted" means TOMBSTONED, never "has no row".
 * Topics that do not need a shop record always run (the purge and the compliance answers). An unrecognised topic is
 * treated like a record-requiring one for tombstones, and otherwise falls through to the retire-unsupported path.
 * `finalAttempt` turns a deferral into a run so the delivery settles instead of dead-lettering unrecorded.
 */
export function decideShopGate(input: {
  readonly topic: string;
  readonly tombstoned: boolean;
  readonly hasShopRecord: boolean;
  readonly finalAttempt: boolean;
}): ShopGateDecision {
  if (isWebhookTopic(input.topic) && !WEBHOOK_TOPICS[input.topic].requiresShopRecord) return "run";
  if (input.tombstoned) return "discard_redacted";
  if (input.hasShopRecord || !isWebhookTopic(input.topic)) return "run";
  return WEBHOOK_TOPICS[input.topic].onUnknownShop === "defer" && !input.finalAttempt ? "defer_unknown_shop" : "run_unknown_shop";
}

/** Seconds before redelivering a deferred webhook: doubles from one minute and caps at an hour (~3 h across the 8 retries). */
export function deferralDelaySeconds(attempts: number): number {
  const exponent = Math.min(Math.max(attempts, 1) - 1, 6);
  return Math.min(60 * 2 ** exponent, 3600);
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
