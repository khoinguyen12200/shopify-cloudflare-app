import { toEnvelope } from "~/notifications/envelope";
import type { NotificationQueue } from "~/ports/notification-queue";

/** Cloudflare Queues producer for notifications. Holds no decisions. */
export class CloudflareNotificationQueue implements NotificationQueue {
  constructor(private readonly queue: { send(body: unknown, options: { contentType: "json" }): Promise<unknown> }) {}

  async enqueue(notification: Parameters<NotificationQueue["enqueue"]>[0]): Promise<void> {
    // `json` makes the JSON-safe envelope a guarantee rather than a hope: a
    // value that cannot survive JSON fails here, at the producer.
    await this.queue.send(toEnvelope(notification), { contentType: "json" });
  }
}
