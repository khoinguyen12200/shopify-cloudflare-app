export interface NotificationLogsPort {
  reserve(input: { readonly id: string; readonly event: string; readonly channel: string; readonly recipient: string; readonly dedupeKey?: string; readonly shop?: string; readonly now: number }): Promise<void>;
  settle(id: string, input: { readonly status: "sent" | "failed" | "refused"; readonly reasonCode?: string; readonly detail?: string; readonly providerStatus?: string; readonly providerMessageId?: string; readonly now: number }): Promise<void>;
  recordSettled(input: { readonly id: string; readonly event: string; readonly channel: string; readonly recipient: string; readonly status: "sent" | "failed" | "refused"; readonly reasonCode?: string; readonly detail?: string; readonly dedupeKey?: string; readonly shop?: string; readonly now: number }): Promise<void>;
  findActiveByDedupe(dedupeKey: string, recipient: string): Promise<{ readonly id: string } | undefined>;
}
