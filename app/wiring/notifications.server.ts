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
