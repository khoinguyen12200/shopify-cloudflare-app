import type { NotificationEvent, ChannelKey } from "~/notifications/types";
import type { PayloadByEvent } from "~/notifications/payloads";

/**
 * The port a use case depends on to send a notification.
 *
 * @rules/design-patterns.md requires a port and adapter for every external call
 * — email included — and this is that seam. It exists for a concrete reason
 * rather than ceremony: an email leaves no database state to assert, so without
 * a port there is no honest way to prove a use case asked for the right one.
 * That is not hypothetical here. `support_staff_reply` was sending with no copy
 * list for as long as the feature existed, and nothing failed, because the only
 * way to observe the request was to read the code.
 *
 * Imports ONLY pure types, so this file stays free of I/O and the fake in
 * `~/test/fake-notifier` needs nothing but an array.
 */
export interface NotifyRequest<E extends NotificationEvent = NotificationEvent> {
  event: E;
  /**
   * Where to reach the recipient, per channel. A channel with no address here is
   * refused as `recipient_unreachable` rather than attempted.
   */
  to: Partial<Record<ChannelKey, string>>;
  /**
   * Addresses to copy on the SAME message, per channel — not extra sends.
   *
   * A copy is a carbon copy of one notification, so it rides the message the
   * primary recipient gets: one email, one thread in everyone's client, one
   * `notification_logs` row. Copies are filtered before use — an address that
   * has opted out is dropped, and the primary recipient is never also copied.
   */
  cc?: Partial<Record<ChannelKey, readonly string[]>>;
  payload: PayloadByEvent[E];
  /** Tenant scope for preferences and opt-outs. Defaults to app-wide. */
  scope?: string;
  /** Idempotency key for (event, recipient). Omit for inherently-unique sends. */
  dedupeKey?: string;
  /** Pre-minted log id, for when the link inside the message must contain it. */
  logId?: string;
}

export interface Notifier {
  send<E extends NotificationEvent>(input: NotifyRequest<E>): Promise<void>;
}
