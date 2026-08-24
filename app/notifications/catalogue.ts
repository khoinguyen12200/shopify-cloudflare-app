import type { ChannelKey, NotificationEvent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ONE declaration per notification event.
//
// CLIENT-SAFE ON PURPOSE. This file holds metadata only — no renderers, no
// server imports. A settings screen can import it to build "which notifications
// do I want?" rows without dragging every email template, and their whole render
// tree, into the browser bundle. That is why the renderers live in
// `templates/registry.server.ts` and not here.
// ─────────────────────────────────────────────────────────────────────────────

/** How an event decides whether it may send. */
export type EventGate =
  /**
   * Always sends. Reserved for messages the recipient cannot opt out of because
   * they asked for them — a password reset, a receipt, a legal notice.
   */
  | "essential"
  /** A stored per-recipient or per-shop preference decides. */
  | "preference"
  /** The caller already decided; this event just describes how to render it. */
  | "caller_gated";

export interface EventSpec {
  /**
   * Who reads it. Staff-facing events skip recipient consent entirely, so
   * conflating the two audiences is how a marketing opt-out ends up silencing an
   * operational alert.
   */
  audience: "customer" | "merchant" | "staff";
  gate: EventGate;
  /** Which channels have a renderer. A channel missing here cannot be asked. */
  channels: readonly ChannelKey[];
  /** Short description, for a settings screen and for whoever reads this file. */
  description: string;
}

/**
 * The catalogue.
 *
 * Typed as `Record<NotificationEvent, EventSpec>`, so adding an event to the
 * union without describing it here is a compile error — and a typo in a key here
 * does not compile either.
 */
export const EVENTS: Record<NotificationEvent, EventSpec> = {
  admin_password_reset: {
    audience: "staff",
    // Essential: someone locked out of the console asked for this link. A
    // preference must never be able to suppress it.
    gate: "essential",
    channels: ["email"],
    description: "A link to choose a new password for the internal console.",
  },
};

/** Does this event have a renderer for this channel? */
export function supportsChannel(
  event: NotificationEvent,
  channel: ChannelKey,
): boolean {
  return EVENTS[event].channels.includes(channel);
}

/** Every event, for a settings screen or an audit. */
export function allEvents(): NotificationEvent[] {
  return Object.keys(EVENTS) as NotificationEvent[];
}
