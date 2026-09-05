import type { ChannelKey, NotificationEvent } from "~/notifications/types";

export const GLOBAL_NOTIFICATION_SCOPE = "global";

export interface NotificationSettingsPort {
  selection(scope: string): Promise<Partial<Record<NotificationEvent, ChannelKey[]>>>;
  optedOutChannels(scope: string, addresses: Partial<Record<ChannelKey, string>>): Promise<ChannelKey[]>;
  optedOutAddresses(scope: string, channel: ChannelKey, addresses: readonly string[]): Promise<Set<string>>;
}
