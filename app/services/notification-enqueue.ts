import type { NotificationLogsPort } from "~/ports/notification-logs";
import type { NotificationQueue } from "~/ports/notification-queue";
import type { Notifier, NotifyRequest } from "~/ports/notifier";
import type { NotificationEvent } from "~/notifications/types";

export interface QueuedNotifierDependencies {
  readonly queue: NotificationQueue;
  /** Only the write that records a notification that never left the request. */
  readonly logs: Pick<NotificationLogsPort, "recordSettled">;
  readonly newId: () => string;
  readonly now: () => number;
  readonly log: (entry: { readonly event: "notification.enqueue_failed"; readonly notification: NotificationEvent; readonly reason: string }) => void;
}

/**
 * The `Notifier` every use case receives: it ENQUEUES, and the queue consumer
 * sends.
 *
 * Never throws. A notification is decoration on the request that triggered it —
 * the record that request wrote has already succeeded — so a queue that refuses
 * the message must not turn that into a 500. It is not silent either: the
 * failure is logged as a structured event and written as a `failed` row, which
 * is what the internal notification history shows.
 */
export function createQueuedNotifier(dependencies: QueuedNotifierDependencies): Notifier {
  return {
    async send(input) {
      // A stable key minted HERE, once, so a queue redelivery after a send that
      // succeeded finds that send's row and stops. A caller's own key wins.
      const dedupeKey = input.dedupeKey ?? `${input.event}:${dependencies.newId()}`;
      try {
        await dependencies.queue.enqueue({ ...input, dedupeKey });
      } catch (cause) {
        await recordEnqueueFailure(input, dedupeKey, cause, dependencies);
      }
    },
  };
}

async function recordEnqueueFailure(
  input: NotifyRequest,
  dedupeKey: string,
  cause: unknown,
  dependencies: QueuedNotifierDependencies,
): Promise<void> {
  dependencies.log({
    event: "notification.enqueue_failed",
    notification: input.event,
    reason: cause instanceof Error ? cause.name : "unknown",
  });

  const now = dependencies.now();
  try {
    if (input.to.email !== undefined) {
      await dependencies.logs.recordSettled({
        id: dependencies.newId(),
        event: input.event,
        channel: "email",
        recipient: input.to.email,
        status: "failed",
        reasonCode: "transport_error",
        detail: "Could not be queued for sending.",
        dedupeKey,
        shop: input.scope,
        now,
      });
    }
  } catch {
    // The row is the secondary record: the structured event above is already
    // out, and a second failure must not break the caller either.
    dependencies.log({
      event: "notification.enqueue_failed",
      notification: input.event,
      reason: "record_failed",
    });
  }
}
