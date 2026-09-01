import { and, asc, eq } from "drizzle-orm";
import { webhookScopeObservations } from "~/db/schema";
import { getDb } from "~/request-context.server";

/** D1 adapter for typed scope values needed after a webhook leaves HTTP. */
export class WebhookScopeObservationRepo {
  async record(deliveryId: string, shop: string, scopes: readonly string[]): Promise<void> {
    const normalized = [...new Set(scopes)].sort();
    if (normalized.length === 0) return;
    await getDb().insert(webhookScopeObservations).values(
      normalized.map((scope) => ({ deliveryId, shop, scope })),
    ).onConflictDoNothing();
  }

  async list(deliveryId: string, shop: string): Promise<string[]> {
    const rows = await getDb().select({ scope: webhookScopeObservations.scope })
      .from(webhookScopeObservations)
      .where(and(
        eq(webhookScopeObservations.deliveryId, deliveryId),
        eq(webhookScopeObservations.shop, shop),
      ))
      .orderBy(asc(webhookScopeObservations.scope));
    return rows.map(({ scope }) => scope);
  }
}
