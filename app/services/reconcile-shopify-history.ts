import type { PartnerHistoryEvent, ShopifyPartnerPort } from "~/ports/shopify-partner";
import type { RedactionGuard } from "~/services/redaction-guard";

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
  readonly cancelEffectiveOn?: string | null;
};
export type ReconcileResult =
  | { readonly status: "succeeded"; readonly pages: number; readonly events: number; readonly suppressed: number }
  | { readonly status: "failed"; readonly code: string; readonly detail: string };

export interface ShopifyShopIdentity {
  readonly shop: string;
  readonly shopifyShopId: string | null;
  readonly installedAt?: number | null;
}

function ledgerEvent(event: PartnerHistoryEvent, synchronizedAt: number): RelationshipLedgerEvent | SubscriptionLedgerEvent | null {
  if (event.kind === "ignored") return null;
  const occurredAt = Date.parse(event.occurredAt);
  if (event.kind === "relationship") return { id: event.id, shop: event.shop, shopifyShopId: event.shopId, type: event.type, occurredAt, synchronizedAt, reason: event.reason, reasonDescription: event.reasonDescription };
  const status = event.type === "CREATED" ? "PENDING" : event.type === "UPDATED" || event.type === "UNFROZEN" ? "ACTIVE" : event.type;
  // SubscriptionStatus.id identifies this event, not a subscription. Partner
  // exposes one active subscription per shop, so history uses same projection key.
  return { id: event.id, shop: event.shop, shopifyShopId: event.shopId, type: event.type, occurredAt, synchronizedAt, subscriptionId: `active:${event.shopId}`, status, planHandle: event.planHandle, billingInterval: event.billingPeriod, cancelEffectiveOn: event.cancelEffectiveOn };
}

export type HistoryRedaction = Pick<RedactionGuard, "redactedAmong">;

function eventShop(event: PartnerHistoryEvent): string | null {
  return event.kind === "ignored" ? null : event.shop;
}

/**
 * Apply one page of Partner events, skipping every event about a redacted shop. The tombstones are looked up with ONE
 * query per page, never one per event. A suppressed event creates no shop row and no event row.
 */
async function recordPage(
  deps: { readonly ledger: LifecycleLedgerPort; readonly clock: Clock; readonly redaction: HistoryRedaction },
  events: readonly PartnerHistoryEvent[],
): Promise<{ readonly recorded: number; readonly suppressed: number }> {
  const shops = [...new Set(events.flatMap((event) => eventShop(event) ?? []))];
  const redacted = await deps.redaction.redactedAmong(shops);
  let recorded = 0;
  let suppressed = 0;
  for (const event of events) {
    const normalized = ledgerEvent(event, deps.clock.now());
    if (!normalized) continue;
    if (redacted.has(normalized.shop)) {
      suppressed += 1;
      continue;
    }
    if ("subscriptionId" in normalized) await deps.ledger.recordPartnerSubscription(normalized);
    else await deps.ledger.recordPartnerRelationship(normalized);
    recorded += 1;
  }
  return { recorded, suppressed };
}

function logSuppressed(event: "partner_history.suppressed", count: number): void {
  if (count > 0) console.log(JSON.stringify({ event, count }));
}

export async function reconcileHistory(deps: {
  readonly partner: ShopifyPartnerPort;
  readonly checkpoint: SyncCheckpointPort;
  readonly ledger: LifecycleLedgerPort;
  readonly clock: Clock;
  readonly appId: string | null;
  readonly redaction: HistoryRedaction;
}, now: number): Promise<ReconcileResult> {
  if (!deps.appId) {
    await deps.checkpoint.markCheckpointFailed(CHECKPOINT, "MISSING_CREDENTIALS", "Partner app ID or token unavailable", now);
    return { status: "failed", code: "MISSING_CREDENTIALS", detail: "Partner app ID or token unavailable" };
  }
  const checkpoint = await deps.checkpoint.readCheckpoint(CHECKPOINT);
  const occurredAtMin = checkpoint?.watermarkAt === null || checkpoint?.watermarkAt === undefined
    ? undefined
    : new Date(checkpoint.watermarkAt - OVERLAP_MS).toISOString();
  const seen = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  let events = 0;
  let suppressed = 0;
  try {
    for (;;) {
      const page = await deps.partner.listHistoricalEvents({
        appId: deps.appId,
        cursor,
        ...(occurredAtMin ? { occurredAtMin } : {}),
      });
      pages += 1;
      // `seen` also dedupes within a page: an id is added the first time it is met.
      const fresh = page.events.filter((event) => !seen.has(event.id) && seen.add(event.id));
      const applied = await recordPage(deps, fresh);
      events += applied.recorded;
      suppressed += applied.suppressed;
      if (!page.hasNextPage) {
        await deps.checkpoint.markCheckpointSucceeded(CHECKPOINT, null, deps.clock.now(), now);
        logSuppressed("partner_history.suppressed", suppressed);
        return { status: "succeeded", pages, events, suppressed };
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

/** Fetch one shop's Partner event stream for a staff-requested D1 refresh. */
export async function reconcileShopHistory(deps: {
  readonly partner: ShopifyPartnerPort;
  readonly ledger: LifecycleLedgerPort;
  readonly clock: Clock;
  readonly appId: string | null;
  readonly redaction: HistoryRedaction;
}, shop: ShopifyShopIdentity, now: number): Promise<ReconcileResult> {
  if (!deps.appId || !shop.shopifyShopId) {
    return { status: "failed", code: "MISSING_CREDENTIALS", detail: "Partner app ID, token, or Shopify shop ID unavailable" };
  }
  let pages = 0;
  let events = 0;
  let suppressed = 0;
  try {
    const start = shop.installedAt ?? now - OVERLAP_MS;
    const windows: { min: number; max: number }[] = [];
    for (let min = start; min < now; min = Math.min(now, min + 365 * 24 * 60 * 60 * 1000)) {
      windows.push({ min, max: Math.min(now, min + 365 * 24 * 60 * 60 * 1000) });
    }
    if (windows.length === 0) windows.push({ min: now - OVERLAP_MS, max: now });
    for (const window of windows) {
      let cursor: string | null = null;
      for (;;) {
      const page = await deps.partner.listHistoricalEvents({ appId: deps.appId, shopId: shop.shopifyShopId, cursor, occurredAtMin: new Date(window.min).toISOString(), occurredAtMax: new Date(window.max).toISOString() });
      pages += 1;
      const applied = await recordPage(deps, page.events);
      events += applied.recorded;
      suppressed += applied.suppressed;
      if (!page.hasNextPage) break;
      if (!page.endCursor) throw new Error("Partner history page omitted end cursor");
      cursor = page.endCursor;
      }
    }
    logSuppressed("partner_history.suppressed", suppressed);
    return { status: "succeeded", pages, events, suppressed };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { status: "failed", code: "HISTORY_SYNC_FAILED", detail: detail.slice(0, 1000) };
  }
}
