import { parseEnvelope, type QueuedNotification } from "~/notifications/envelope";
import type { NotificationEvent } from "~/notifications/types";

export interface NotificationMessageLike {
  readonly body: unknown;
  /** Deliveries so far, including this one (starts at 1). */
  readonly attempts: number;
  readonly ack: () => void;
  readonly retry: (options?: { readonly delaySeconds?: number }) => void;
}

export interface NotificationBatchLike {
  readonly messages: readonly NotificationMessageLike[];
}

/** What the consumer needs of `notify()`: the statuses it produced, nothing more. */
export interface NotificationSendResult {
  readonly dispatched: readonly { readonly outcome: { readonly status: "sent" | "failed" | "refused" }; readonly skipped: boolean }[];
}

export type NotificationQueueLog =
  | { readonly event: "notification.queue_invalid"; readonly reason: string }
  | {
      readonly event: "notification.queue_sent" | "notification.queue_retry";
      readonly notification: NotificationEvent;
      readonly attempts: number;
      readonly outcome: string;
      readonly delaySeconds?: number;
    };

export interface NotificationConsumerDependencies {
  readonly send: (request: QueuedNotification) => Promise<NotificationSendResult>;
  readonly log: (entry: NotificationQueueLog) => void;
}

const BASE_DELAY_SECONDS = 30;
const MAX_DELAY_SECONDS = 60 * 60;

/**
 * Exponential backoff that spans an outage: 30s, 1m, 2m, 4m … capped at one
 * hour, so the queue's eight retries cover a couple of hours rather than a
 * minute. `attempts` is the delivery count, so the first retry waits 30s.
 */
export function retryDelaySeconds(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(BASE_DELAY_SECONDS * 2 ** exponent, MAX_DELAY_SECONDS);
}

export async function handleNotificationBatch(
  batch: NotificationBatchLike,
  dependencies: NotificationConsumerDependencies,
): Promise<void> {
  for (const message of batch.messages) {
    await processNotificationMessage(message, dependencies);
  }
}

export async function processNotificationMessage(
  message: NotificationMessageLike,
  dependencies: NotificationConsumerDependencies,
): Promise<void> {
  const parsed = parseEnvelope(message.body);
  if (!parsed.ok) {
    // The same bytes can never become valid, so a retry only burns attempts.
    dependencies.log({ event: "notification.queue_invalid", reason: parsed.reason });
    message.ack();
    return;
  }

  const request = withFreshLogId(parsed.value, message.attempts);
  let result: NotificationSendResult;
  try {
    result = await dependencies.send(request);
  } catch (cause) {
    const delaySeconds = retryDelaySeconds(message.attempts);
    dependencies.log({
      event: "notification.queue_retry",
      notification: request.event,
      attempts: message.attempts,
      outcome: cause instanceof Error ? cause.name : "unknown",
      delaySeconds,
    });
    message.retry({ delaySeconds });
    return;
  }

  dependencies.log({
    event: "notification.queue_sent",
    notification: request.event,
    attempts: message.attempts,
    outcome: summarize(result),
  });
  // A permanent failure or refusal is already recorded as its own row, and
  // sending again cannot change it: settled, so acknowledged.
  message.ack();
}

/**
 * A pre-minted log id names ONE row, and the first attempt already wrote it. A
 * redelivery reserving the same id would collide on the primary key and could
 * never succeed, so later attempts mint their own.
 */
function withFreshLogId(request: QueuedNotification, attempts: number): QueuedNotification {
  if (attempts <= 1 || request.logId === undefined) return request;
  return { ...request, logId: undefined };
}

function summarize(result: NotificationSendResult): string {
  if (result.dispatched.length === 0) return "refused";
  return result.dispatched
    .map((entry) => (entry.skipped ? "duplicate" : entry.outcome.status))
    .join(",");
}
