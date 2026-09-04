import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  type WebhookDelivery,
  webhookDeliveries,
} from "~/db/schema";
import { getDb } from "~/request-context.server";
import type { WebhookDeliveryInput } from "~/ports/webhook-deliveries";
import type { WebhookDeliveryStatus } from "~/domain/webhook-delivery-lifecycle";

export type { WebhookDeliveryInput } from "~/ports/webhook-deliveries";

/**
 * The sole D1 adapter for the webhook delivery inbox. A delivery ID is a
 * global Shopify idempotency key; every subsequent tenant read is shop scoped.
 */
export class WebhookDeliveryRepo {
  async listForShop(shop: string): Promise<WebhookDelivery[]> {
    return getDb()
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.shop, shop))
      .orderBy(desc(webhookDeliveries.receivedAt));
  }

  async markDeadLetter(shop: string, id: string, failedAt: number, detail: string, expectedFrom: WebhookDeliveryStatus = "failed"): Promise<"applied" | "conflict"> {
    const changed = await getDb().update(webhookDeliveries).set({ status: "dead_letter", failedAt, failureCode: "dead_letter", failureDetail: detail.slice(0, 1000) }).where(and(eq(webhookDeliveries.shop, shop), eq(webhookDeliveries.id, id), eq(webhookDeliveries.status, expectedFrom))).returning({ id: webhookDeliveries.id });
    return changed.length === 1 ? "applied" : "conflict";
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
  async markQueued(shop: string, id: string, expectedFrom: WebhookDeliveryStatus = "received"): Promise<void> {
    await getDb()
      .update(webhookDeliveries)
      .set({ status: "queued" })
      .where(
        and(
          eq(webhookDeliveries.shop, shop),
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, expectedFrom),
        ),
      );
  }

  async markProcessing(
    shop: string,
    id: string,
    startedAt: number,
    expectedFrom: WebhookDeliveryStatus,
    expectedProcessingStartedAt: number | null,
  ): Promise<"applied" | "conflict"> {
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
          eq(webhookDeliveries.status, expectedFrom),
          expectedProcessingStartedAt === null
            ? isNull(webhookDeliveries.processingStartedAt)
            : eq(webhookDeliveries.processingStartedAt, expectedProcessingStartedAt),
        ),
      )
      .returning({ id: webhookDeliveries.id });
    return claimed.length === 1 ? "applied" : "conflict";
  }

  async markProcessed(shop: string, id: string, processedAt: number, expectedFrom: WebhookDeliveryStatus = "processing", expectedProcessingStartedAt?: number | null): Promise<"applied" | "conflict"> {
    const changed = await getDb()
      .update(webhookDeliveries)
      .set({ status: "processed", processedAt, processingStartedAt: null })
      .where(
        and(
          eq(webhookDeliveries.shop, shop),
          eq(webhookDeliveries.id, id),
          eq(webhookDeliveries.status, expectedFrom),
          ...(expectedProcessingStartedAt === undefined ? [] : [expectedProcessingStartedAt === null ? isNull(webhookDeliveries.processingStartedAt) : eq(webhookDeliveries.processingStartedAt, expectedProcessingStartedAt)]),
        ),
      ).returning({ id: webhookDeliveries.id });
    return changed.length === 1 ? "applied" : "conflict";
  }

  async markFailed(
    shop: string,
    id: string,
    failure: {
      readonly failedAt: number;
      readonly failureCode: string;
      readonly failureDetail: string;
    },
    expectedFrom: WebhookDeliveryStatus = "processing",
    expectedProcessingStartedAt?: number | null,
  ): Promise<"applied" | "conflict"> {
    const changed = await getDb()
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
          eq(webhookDeliveries.status, expectedFrom),
          ...(expectedProcessingStartedAt === undefined ? [] : [expectedProcessingStartedAt === null ? isNull(webhookDeliveries.processingStartedAt) : eq(webhookDeliveries.processingStartedAt, expectedProcessingStartedAt)]),
        ),
      ).returning({ id: webhookDeliveries.id });
    return changed.length === 1 ? "applied" : "conflict";
  }
}
