import type { QueuedNotification } from "~/notifications/envelope";

/**
 * Hands one notification to the queue that will send it.
 *
 * The request path only ever ENQUEUES: it returns as soon as the message is
 * durable, and the consumer owns the send, so a transient provider failure is
 * retried instead of failing a request whose database write already succeeded.
 *
 * Rejects when the queue refuses the message; callers decide how to degrade.
 */
export interface NotificationQueue {
  enqueue(notification: QueuedNotification): Promise<void>;
}
