import { CloudflareNotificationQueue } from "~/adapters/notification-queue.server";
import { notify } from "~/notifications/notify.server";
import type { Notifier } from "~/ports/notifier";
import { getEnv } from "~/request-context.server";
import { createQueuedNotifier } from "~/services/notification-enqueue";
import type { NotificationConsumerDependencies } from "~/services/notification-queue";
import { NotificationLogRepo } from "~/models/notification-logs.server";
import { NotificationSettingsRepo } from "~/models/notification-settings.server";
import type { NotificationLogsPort } from "~/ports/notification-logs";
import type { NotificationSettingsPort } from "~/ports/notification-settings";

export function notificationLogs(): NotificationLogsPort { return new NotificationLogRepo(); }
export function notificationSettings(): NotificationSettingsPort { return new NotificationSettingsRepo(); }
export function notificationDependencies(): {
  readonly logs: NotificationLogsPort;
  readonly settings: NotificationSettingsPort;
} {
  return { logs: notificationLogs(), settings: notificationSettings() };
}

/** The `Notifier` use cases receive: enqueues, never sends inline. */
export function queuedNotifier(): Notifier {
  return createQueuedNotifier({
    queue: new CloudflareNotificationQueue(getEnv().NOTIFICATION_QUEUE),
    logs: notificationLogs(),
    newId: () => crypto.randomUUID(),
    now: () => Date.now(),
    log: (entry) => console.error(JSON.stringify(entry)),
  });
}

/** What the queue consumer runs per message: the one `notify()` entry point. */
export function notificationConsumerDependencies(): NotificationConsumerDependencies {
  return {
    send: (request) => notify(request, notificationDependencies()),
    log: (entry) => console[entry.event === "notification.queue_sent" ? "log" : "warn"](JSON.stringify(entry)),
  };
}
