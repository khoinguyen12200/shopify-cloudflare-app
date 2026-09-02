import { and, asc, eq } from "drizzle-orm";
import { webhookScopeObservations, shopGrantedScopes, shopScopeChanges, shopScopeChangeItems } from "~/db/schema";
import { getDb } from "~/request-context.server";

/** D1 adapter for typed scope values needed after a webhook leaves HTTP. */
export class WebhookScopeObservationRepo {
  async applyScopes(deliveryId: string, shop: string, scopes: readonly string[], occurredAt: number): Promise<"applied" | "duplicate"> {
    const db = getDb();
    const existing = await db.select({ id: shopScopeChanges.id }).from(shopScopeChanges).where(eq(shopScopeChanges.id, deliveryId)).limit(1);
    if (existing.length) return "duplicate";
    const next = [...new Set(scopes)].sort();
    const previous = await db.select({ scope: shopGrantedScopes.scope }).from(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop));
    const before = new Set(previous.map((row) => row.scope));
    const added = next.filter((scope) => !before.has(scope));
    const removed = previous.map((row) => row.scope).filter((scope) => !next.includes(scope));
    await db.batch([
      db.insert(shopScopeChanges).values({ id: deliveryId, shop, source: "webhook", occurredAt }),
      db.delete(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)),
      ...(next.length ? [db.insert(shopGrantedScopes).values(next.map((scope) => ({ shop, scope, grantedAt: occurredAt })))] : []),
      ...((added.length || removed.length) ? [db.insert(shopScopeChangeItems).values([...added.map((scope) => ({ scopeChangeId: deliveryId, scope, change: "granted" as const })), ...removed.map((scope) => ({ scopeChangeId: deliveryId, scope, change: "revoked" as const }))])] : []),
    ]);
    return "applied";
  }
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
