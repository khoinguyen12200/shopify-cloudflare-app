import { and, eq, inArray, sql } from "drizzle-orm";
import {
  type WebhookDelivery,
  webhookDeliveries,
} from "~/db/schema";
import { getDb } from "~/request-context.server";
import type { WebhookDeliveryInput } from "~/ports/webhook-deliveries";

export type { WebhookDeliveryInput } from "~/ports/webhook-deliveries";

/**
 * The sole D1 adapter for the webhook delivery inbox. A delivery ID is a
 * global Shopify idempotency key; every subsequent tenant read is shop scoped.
 */
export class WebhookDeliveryRepo {
  async markDeadLetter(shop: string, id: string, failedAt: number, detail: string): Promise<void> {
    await getDb().update(webhookDeliveries).set({ status: "dead_letter", failedAt, failureCode: "dead_letter", failureDetail: detail.slice(0, 1000) }).where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, id), eq(webhookDeliveries.status, "failed")));
  }
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

  /** The worker is not allowed to claim a delivery until its queue handoff succeeded. */
  async markQueued(shop: string, id: string): Promise<void> {
    await getDb()
      .update(webhookDeliveries)
      .set({ status: "queued" })
      .where(
        and(
          eq(webhookDeliveries.shop, shop),
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, "received"),
        ),
      );
  }

  async markProcessing(
    shop: string,
    id: string,
    startedAt: number,
  ): Promise<"claimed" | "unavailable"> {
    const claimed = await getDb()
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
      .where(
        and(
          eq(webhookDeliveries.shop, shop),
          eq(webhookDeliveries.id, id),
          inArray(webhookDeliveries.status, ["received", "queued", "failed"]),
        ),
      )
      .returning({ id: webhookDeliveries.id });
    return claimed.length === 1 ? "claimed" : "unavailable";
  }

  async markProcessed(shop: string, id: string, processedAt: number): Promise<void> {
    await getDb()
      .update(webhookDeliveries)
      .set({ status: "processed", processedAt })
      .where(
        and(
          eq(webhookDeliveries.shop, shop),
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, "processing"),
        ),
      );
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
      .where(
        and(
          eq(webhookDeliveries.shop, shop),
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, "processing"),
        ),
      );
  }
}
