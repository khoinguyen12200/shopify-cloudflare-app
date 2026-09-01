import { and, eq, sql } from "drizzle-orm";
import {
  type NewWebhookDelivery,
  type WebhookDelivery,
  webhookDeliveries,
} from "~/db/schema";
import { getDb } from "~/request-context.server";

export type WebhookDeliveryInput = Omit<
  NewWebhookDelivery,
  | "status"
  | "attempts"
  | "processingStartedAt"
  | "processedAt"
  | "failedAt"
  | "failureCode"
  | "failureDetail"
>;

/**
 * The sole D1 adapter for the webhook delivery inbox. A delivery ID is a
 * global Shopify idempotency key; every subsequent tenant read is shop scoped.
 */
export class WebhookDeliveryRepo {
  async claim(input: WebhookDeliveryInput): Promise<"claimed" | "duplicate"> {
    const inserted = await getDb()
      .insert(webhookDeliveries)
      .values(input)
      .onConflictDoNothing()
      .returning({ id: webhookDeliveries.id });
    return inserted.length === 1 ? "claimed" : "duplicate";
  }

  async get(shop: string, id: string): Promise<WebhookDelivery | undefined> {
    const [delivery] = await getDb()
      .select()
      .from(webhookDeliveries)
      .where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, id)))
      .limit(1);
    return delivery;
  }

  async markProcessing(shop: string, id: string, startedAt: number): Promise<void> {
    await getDb()
      .update(webhookDeliveries)
      .set({
        status: "processing",
        attempts: sql`${webhookDeliveries.attempts} + 1`,
        processingStartedAt: startedAt,
        processedAt: null,
        failedAt: null,
        failureCode: null,
        failureDetail: null,
      })
      .where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, id)));
  }

  async markProcessed(shop: string, id: string, processedAt: number): Promise<void> {
    await getDb()
      .update(webhookDeliveries)
      .set({ status: "processed", processedAt })
      .where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, id)));
  }

  async markFailed(
    shop: string,
    id: string,
    failure: {
      readonly failedAt: number;
      readonly failureCode: string;
      readonly failureDetail: string;
    },
  ): Promise<void> {
    await getDb()
      .update(webhookDeliveries)
      .set({
        status: "failed",
        failedAt: failure.failedAt,
        failureCode: failure.failureCode,
        failureDetail: failure.failureDetail,
      })
      .where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, id)));
  }
}
