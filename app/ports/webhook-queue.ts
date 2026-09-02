import { z } from "zod";

export interface QueuedWebhook {
  readonly shop: string;
  readonly id: string;
  readonly attempts?: number;
}

const queuedWebhookSchema = z.object({ shop: z.string().min(1), id: z.string().min(1) });

export function isQueuedWebhook(value: unknown): value is QueuedWebhook {
  return queuedWebhookSchema.safeParse(value).success;
}
