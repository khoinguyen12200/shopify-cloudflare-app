import { err, ok, type Result } from "~/lib/result";

export type WebhookTopic = "app/uninstalled" | "app/scopes_update";

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
  return value === "app/uninstalled" || value === "app/scopes_update";
}
