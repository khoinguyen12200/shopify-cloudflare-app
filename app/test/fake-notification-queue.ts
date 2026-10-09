import type { QueuedNotification } from "~/notifications/envelope";
import { toEnvelope } from "~/notifications/envelope";
import type { NotificationQueue } from "~/ports/notification-queue";
import type { NotificationMessageLike } from "~/services/notification-queue";

/**
 * A `NotificationQueue` that keeps what it was given instead of delivering it.
 *
 * The queue transport is the outermost boundary for this effect. Recording the
 * envelope lets a test prove exactly what a producer enqueued, then hand the
 * same bytes to the real consumer.
 */
export interface FakeNotificationQueue extends NotificationQueue {
  readonly enqueued: QueuedNotification[];
  /** Every enqueue rejects, as a queue that is down would. */
  failWith(error: Error): void;
  /** The envelopes as they would travel on the wire. */
  bodies(): unknown[];
}

export function fakeNotificationQueue(): FakeNotificationQueue {
  const enqueued: QueuedNotification[] = [];
  let failure: Error | undefined;
  return {
    enqueued,
    failWith(error) {
      failure = error;
    },
    bodies: () => enqueued.map((notification) => JSON.parse(JSON.stringify(toEnvelope(notification)))),
    async enqueue(notification) {
      if (failure) throw failure;
      enqueued.push(notification);
    },
  };
}

export interface RecordedMessage extends NotificationMessageLike {
  /** What the consumer did with it: `ack` or `retry:<delaySeconds>`. */
  readonly settled: string[];
}

/** A delivery of one message, remembering how the consumer settled it. */
export function recordedMessage(body: unknown, attempts = 1): RecordedMessage {
  const settled: string[] = [];
  return {
    body,
    attempts,
    settled,
    ack: () => { settled.push("ack"); },
    retry: (options) => { settled.push(`retry:${options?.delaySeconds ?? 0}`); },
  };
}

/**
 * A Queue BINDING that records bodies instead of delivering them — for tests
 * that run the real wiring (`supportService()`) and need to observe what it put
 * on the queue. Pass `binding` as `NOTIFICATION_QUEUE` in a copy of `env`.
 */
export function fakeQueueBinding() {
  const bodies: unknown[] = [];
  return {
    bodies,
    binding: {
      send: async (body: unknown) => { bodies.push(body); },
    },
  };
}
