import { decideScopesUpdate, relationshipOf, type ShopRelationshipFacts } from "~/domain/webhook-ordering";
import { shopLog } from "~/observability/shop-log";
import type { WebhookHandler } from "~/services/webhook-consumer";

export interface ScopesUpdatePorts {
  readonly shops: { facts(shop: string): Promise<ShopRelationshipFacts | undefined> };
  readonly scopes: {
    list(deliveryId: string, shop: string): Promise<readonly string[]>;
    latestChangeAt(shop: string): Promise<number | null>;
    applyScopes(deliveryId: string, shop: string, scopes: readonly string[], occurredAt: number): Promise<"applied" | "duplicate">;
  };
  /** Stamps the scope string onto every stored session of the shop. Idempotent. */
  readonly sessions: { updateScope(shop: string, scope: string): Promise<void> };
}

/**
 * `app/scopes_update` carries the complete scope set, so it is applied in trigger-time order: a delivery older than
 * a change already applied is dropped instead of reverting it. The change is recorded at the delivery's trigger
 * time, which is what later deliveries are compared with.
 */
export function appScopesUpdateHandler(ports: ScopesUpdatePorts): WebhookHandler {
  return async (delivery) => {
    const facts = await ports.shops.facts(delivery.shop);
    const decision = decideScopesUpdate({
      relationship: facts ? relationshipOf(facts) : null,
      latestAppliedChangeAt: await ports.scopes.latestChangeAt(delivery.shop),
      triggeredAt: delivery.triggeredAt,
    });
    if (decision.outcome === "ignore") {
      await shopLog("shopify.scopes_update.ignored", delivery.shop, { reason: decision.reason, triggeredAt: delivery.triggeredAt });
      return;
    }
    const current = await ports.scopes.list(delivery.id, delivery.shop);
    await ports.scopes.applyScopes(delivery.id, delivery.shop, current, delivery.triggeredAt);
    // Also on a duplicate: a retry after a partial failure must still finish stamping the sessions.
    await ports.sessions.updateScope(delivery.shop, current.join(","));
  };
}
