import { describe, expect, it } from "vitest";
import {
  handleNotificationBatch,
  retryDelaySeconds,
  type NotificationConsumerDependencies,
  type NotificationQueueLog,
} from "./notification-queue";
import { toEnvelope, type QueuedNotification } from "~/notifications/envelope";
import { recordedMessage } from "~/test/fake-notification-queue";

const notification: QueuedNotification = {
  event: "admin_password_reset",
  to: { email: "ops@workmanjsc.vn" },
  dedupeKey: "k",
  logId: "log-1",
  payload: { recipientName: "Ops", resetUrl: "https://app.workmanjsc.vn/r/t", expiresIn: "one hour" },
};

function harness(send: NotificationConsumerDependencies["send"]) {
  const logs: NotificationQueueLog[] = [];
  const seen: QueuedNotification[] = [];
  const dependencies: NotificationConsumerDependencies = {
    send: async (request) => { seen.push(request); return send(request); },
    log: (entry) => { logs.push(entry); },
  };
  return { dependencies, logs, seen };
}

const sent = async () => ({ dispatched: [{ outcome: { status: "sent" as const }, skipped: false }] });

describe("retryDelaySeconds", () => {
  it("doubles from 30s and caps at one hour", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(retryDelaySeconds)).toEqual([30, 60, 120, 240, 480, 960, 1920, 3600, 3600, 3600]);
  });
});

describe("notification consumer", () => {
  it("acks a message once it is sent", async () => {
    const { dependencies, logs } = harness(sent);
    const message = recordedMessage(toEnvelope(notification));
    await handleNotificationBatch({ messages: [message] }, dependencies);
    expect(message.settled).toEqual(["ack"]);
    expect(logs).toEqual([expect.objectContaining({ event: "notification.queue_sent", outcome: "sent" })]);
  });

  it("acks a refusal: it is recorded and resending cannot change it", async () => {
    const { dependencies, logs } = harness(async () => ({ dispatched: [] }));
    const message = recordedMessage(toEnvelope(notification));
    await handleNotificationBatch({ messages: [message] }, dependencies);
    expect(message.settled).toEqual(["ack"]);
    expect(logs[0]).toMatchObject({ outcome: "refused" });
  });

  it("retries with backoff when sending throws", async () => {
    const { dependencies, logs } = harness(async () => { throw new Error("provider down"); });
    const first = recordedMessage(toEnvelope(notification), 1);
    const third = recordedMessage(toEnvelope(notification), 3);
    await handleNotificationBatch({ messages: [first, third] }, dependencies);
    expect(first.settled).toEqual(["retry:30"]);
    expect(third.settled).toEqual(["retry:120"]);
    expect(logs[0]).toMatchObject({ event: "notification.queue_retry", delaySeconds: 30 });
    // The error text can carry an address, so only its name is logged.
    expect(JSON.stringify(logs)).not.toContain("provider down");
  });

  it("acks and logs an invalid envelope instead of retrying it", async () => {
    const { dependencies, logs, seen } = harness(sent);
    const message = recordedMessage({ event: "admin_password_reset", payload: {} });
    await handleNotificationBatch({ messages: [message] }, dependencies);
    expect(message.settled).toEqual(["ack"]);
    expect(seen).toHaveLength(0);
    expect(logs).toEqual([{ event: "notification.queue_invalid", reason: "malformed" }]);
  });

  it("does not reuse a spent log id on a redelivery", async () => {
    const { dependencies, seen } = harness(sent);
    await handleNotificationBatch({ messages: [recordedMessage(toEnvelope(notification), 1), recordedMessage(toEnvelope(notification), 2)] }, dependencies);
    expect(seen.map((request) => request.logId)).toEqual(["log-1", undefined]);
  });

  it("settles each message independently", async () => {
    let calls = 0;
    const { dependencies } = harness(async () => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return sent();
    });
    const a = recordedMessage(toEnvelope(notification));
    const b = recordedMessage(toEnvelope(notification));
    await handleNotificationBatch({ messages: [a, b] }, dependencies);
    expect([a.settled, b.settled]).toEqual([["retry:30"], ["ack"]]);
  });
});
