import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { NotificationLogRepo } from "~/models/notification-logs.server";
import { handleNotificationBatch } from "~/services/notification-queue";
import { notificationConsumerDependencies } from "~/wiring/notifications.server";
import { recordedMessage } from "~/test/fake-notification-queue";
import { toEnvelope, type QueuedNotification } from "./envelope";

setupTestDatabase();

// The Email Sending binding is the outermost boundary: it is replaced, so nothing
// leaves the machine. The recipient is on a domain we own regardless.
const RECIPIENT = "staff@workmanjsc.vn";

const notification: QueuedNotification = {
  event: "support_merchant_activity",
  to: { email: RECIPIENT },
  dedupeKey: "support_merchant_activity:ticket-1",
  payload: {
    recipientName: "Staff",
    shopName: "Shop",
    subject: "Help",
    excerpt: "Hello",
    threadUrl: "https://app.workmanjsc.vn/internal/support/1",
    isNew: true,
  },
};

type SendFn = (message: unknown) => Promise<{ messageId: string }>;

/** A worker env whose Email Sending binding is `send`, with a sender configured. */
function envWith(send: SendFn): Env {
  return Object.assign({}, env, { EMAIL: { send }, EMAIL_FROM: "noreply@workmanjsc.vn" });
}

async function deliver(send: SendFn, body: unknown, attempts: number) {
  const message = recordedMessage(body, attempts);
  await runWithRequestContext(envWith(send), () =>
    handleNotificationBatch({ messages: [message] }, notificationConsumerDependencies()),
  );
  return message;
}

const rows = () => runWithRequestContext(env, () => new NotificationLogRepo().recent());

describe("the notification consumer, against real D1", () => {
  it("sends once when the same message is delivered twice", async () => {
    const sends: unknown[] = [];
    const send: SendFn = async (message) => { sends.push(message); return { messageId: "m-1" }; };
    const body = toEnvelope(notification);

    const first = await deliver(send, body, 1);
    const redelivery = await deliver(send, body, 2);

    expect(first.settled).toEqual(["ack"]);
    expect(redelivery.settled).toEqual(["ack"]);
    expect(sends).toHaveLength(1);
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ status: "sent", recipient: RECIPIENT, dedupeKey: notification.dedupeKey });
  });

  it("retries a transient failure with a delay, then sends on the next delivery", async () => {
    const body = toEnvelope({ ...notification, logId: "pre-minted-log" });
    const down: SendFn = async () => { throw new Error("503 upstream unavailable"); };
    const up: SendFn = async () => ({ messageId: "m-2" });

    const failed = await deliver(down, body, 1);
    expect(failed.settled).toEqual(["retry:30"]);
    expect((await rows()).map((row) => row.status)).toEqual(["failed"]);

    const recovered = await deliver(up, body, 2);
    expect(recovered.settled).toEqual(["ack"]);
    const stored = await rows();
    expect(stored.map((row) => row.status).sort()).toEqual(["failed", "sent"]);
  });

  it("acks a permanent failure and records it as failed", async () => {
    let sends = 0;
    const suppressed: SendFn = async () => { sends += 1; throw new Error("recipient is suppressed"); };

    const message = await deliver(suppressed, toEnvelope(notification), 1);

    expect(message.settled).toEqual(["ack"]);
    expect(sends).toBe(1);
    const [row] = await rows();
    expect(row).toMatchObject({ status: "failed", reasonCode: "rejected" });
  });

  it("acks and records a refusal when no mailer is configured", async () => {
    const message = recordedMessage(toEnvelope(notification), 1);
    await runWithRequestContext(env, () =>
      handleNotificationBatch({ messages: [message] }, notificationConsumerDependencies()),
    );
    expect(message.settled).toEqual(["ack"]);
    expect((await rows())[0]).toMatchObject({ status: "refused", reasonCode: "channel_unavailable" });
  });

  it("acks an invalid envelope without sending or writing a row", async () => {
    let sends = 0;
    const message = await deliver(async () => { sends += 1; return { messageId: "x" }; }, { event: "retired_event" }, 1);
    expect(message.settled).toEqual(["ack"]);
    expect(sends).toBe(0);
    expect(await rows()).toHaveLength(0);
  });
});
