import type { PartnerHistoryEvent, ShopifyPartnerPort } from "~/ports/shopify-partner";

const CHECKPOINT = "partner_history";
const OVERLAP_MS = 24 * 60 * 60 * 1000;

export interface Clock { readonly now: () => number; }
export interface SyncCheckpointPort {
  readCheckpoint(name: string): Promise<{ readonly cursor: string | null; readonly watermarkAt: number | null } | null>;
  markCheckpointSucceeded(name: string, cursor: string | null, watermarkAt: number, now: number): Promise<void>;
  markCheckpointFailed(name: string, code: string, detail: string, now: number): Promise<void>;
}
export interface LifecycleLedgerPort {
  recordPartnerRelationship(event: RelationshipLedgerEvent): Promise<"inserted" | "duplicate">;
  recordPartnerSubscription(event: SubscriptionLedgerEvent): Promise<"inserted" | "duplicate">;
}
export type RelationshipLedgerEvent = {
  readonly id: string;
  readonly shop: string;
  readonly shopifyShopId: string;
  readonly type: "INSTALLED" | "UNINSTALLED" | "DEACTIVATED" | "REACTIVATED";
  readonly occurredAt: number;
  readonly synchronizedAt: number;
  readonly reason: string | null;
  readonly reasonDescription: string | null;
};
export type SubscriptionLedgerEvent = {
  readonly id: string;
  readonly shop: string;
  readonly shopifyShopId: string;
  readonly type: "CREATED" | "UPDATED" | "CANCELLATION_SCHEDULED" | "CANCELED" | "FROZEN" | "UNFROZEN";
  readonly occurredAt: number;
  readonly synchronizedAt: number;
  readonly subscriptionId: string;
  readonly status: "NONE" | "PENDING" | "ACTIVE" | "CANCELLATION_SCHEDULED" | "FROZEN" | "CANCELED" | "UNKNOWN";
  readonly planHandle?: string | null;
  readonly billingInterval?: string | null;
};
export type ReconcileResult =
  | { readonly status: "succeeded"; readonly pages: number; readonly events: number }
  | { readonly status: "failed"; readonly code: string; readonly detail: string };

function ledgerEvent(event: PartnerHistoryEvent, synchronizedAt: number): RelationshipLedgerEvent | SubscriptionLedgerEvent | null {
  if (event.kind === "ignored") return null;
  const occurredAt = Date.parse(event.occurredAt);
  if (event.kind === "relationship") return { id: event.id, shop: event.shop, shopifyShopId: event.shopId, type: event.type, occurredAt, synchronizedAt, reason: null, reasonDescription: null };
  const status = event.type === "CREATED" ? "PENDING" : event.type === "UPDATED" || event.type === "UNFROZEN" ? "ACTIVE" : event.type;
  return { id: event.id, shop: event.shop, shopifyShopId: event.shopId, type: event.type, occurredAt, synchronizedAt, subscriptionId: event.id, status, planHandle: event.planHandle, billingInterval: event.billingPeriod };
}

export async function reconcileHistory(deps: {
  readonly partner: ShopifyPartnerPort;
  readonly checkpoint: SyncCheckpointPort;
  readonly ledger: LifecycleLedgerPort;
  readonly clock: Clock;
  readonly appId: string | null;
}, now: number): Promise<ReconcileResult> {
  if (!deps.appId) {
    await deps.checkpoint.markCheckpointFailed(CHECKPOINT, "MISSING_CREDENTIALS", "Partner app ID or token unavailable", now);
    return { status: "failed", code: "MISSING_CREDENTIALS", detail: "Partner app ID or token unavailable" };
  }
  const checkpoint = await deps.checkpoint.readCheckpoint(CHECKPOINT);
  const overlapFrom = (checkpoint?.watermarkAt ?? deps.clock.now()) - OVERLAP_MS;
  const occurredAtMin = new Date(overlapFrom).toISOString();
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  let events = 0;
  try {
    for (;;) {
      const page = await deps.partner.listHistoricalEvents({ appId: deps.appId, cursor, occurredAtMin });
      pages += 1;
      for (const event of page.events) {
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        const normalized = ledgerEvent(event, deps.clock.now());
        if (!normalized) continue;
        if ("subscriptionId" in normalized) await deps.ledger.recordPartnerSubscription(normalized);
        else await deps.ledger.recordPartnerRelationship(normalized);
        events += 1;
      }
      if (!page.hasNextPage) {
        await deps.checkpoint.markCheckpointSucceeded(CHECKPOINT, null, deps.clock.now(), now);
        return { status: "succeeded", pages, events };
      }
      if (!page.endCursor) throw new Error("Partner history page omitted end cursor");
      cursor = page.endCursor;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await deps.checkpoint.markCheckpointFailed(CHECKPOINT, "HISTORY_SYNC_FAILED", detail, now);
    return { status: "failed", code: "HISTORY_SYNC_FAILED", detail: detail.slice(0, 1000) };
  }
}
