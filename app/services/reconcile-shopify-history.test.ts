import { describe, expect, it } from "vitest";
import { reconcileHistory, type LifecycleLedgerPort, type SyncCheckpointPort } from "./reconcile-shopify-history";
import type { ShopifyPartnerPort } from "~/ports/shopify-partner";

function event(id: string, occurredAt = "2026-01-01T00:00:00.000Z") {
  return { kind: "relationship" as const, id, occurredAt, shop: "one.myshopify.com", shopId: "gid://shopify/Shop/1", type: "INSTALLED" as const };
}

describe("reconcileHistory", () => {
  it("pages 250-item history with overlap, dedupes IDs, then advances checkpoint", async () => {
    const calls: Parameters<ShopifyPartnerPort["listHistoricalEvents"]>[0][] = [];
    const partner: ShopifyPartnerPort = {
      activeSubscription: async () => null,
      listHistoricalEvents: async (input) => {
        calls.push(input);
        return calls.length === 1
          ? { events: [event("evt-1"), event("evt-1")], hasNextPage: true, endCursor: "next" }
          : { events: [event("evt-2")], hasNextPage: false, endCursor: null };
      },
    };
    const recorded: string[] = [];
    const ledger: LifecycleLedgerPort = { recordPartnerRelationship: async (value) => { recorded.push(value.id); return "inserted"; }, recordPartnerSubscription: async (value) => { recorded.push(value.id); return "inserted"; } };
    let success: unknown;
    const checkpoint: SyncCheckpointPort = {
      readCheckpoint: async () => ({ cursor: "old", watermarkAt: 1 }),
      markCheckpointSucceeded: async (...args) => { success = args; },
      markCheckpointFailed: async () => { throw new Error("unexpected"); },
    };

    await expect(reconcileHistory({ partner, checkpoint, ledger, clock: { now: () => 2_000 }, appId: "app" }, 2_000)).resolves.toMatchObject({ status: "succeeded" });
    expect(calls).toEqual([
      { appId: "app", cursor: "old", occurredAtMin: "1969-12-31T00:00:00.001Z" },
      { appId: "app", cursor: "next", occurredAtMin: "1969-12-31T00:00:00.001Z" },
    ]);
    expect(recorded).toEqual(["evt-1", "evt-2"]);
    expect(success).toEqual(["partner_history", null, 2000, 2000]);
  });

  it("records bounded failure and does not advance checkpoint when a page fails", async () => {
    let failure: unknown;
    const checkpoint: SyncCheckpointPort = {
      readCheckpoint: async () => null,
      markCheckpointSucceeded: async () => { throw new Error("unexpected"); },
      markCheckpointFailed: async (...args) => { failure = args; },
    };
    const partner: ShopifyPartnerPort = {
      activeSubscription: async () => null,
      listHistoricalEvents: async () => { throw new Error("network down"); },
    };
    await expect(reconcileHistory({ partner, checkpoint, ledger: { recordPartnerRelationship: async () => "inserted", recordPartnerSubscription: async () => "inserted" }, clock: { now: () => 10 }, appId: "app" }, 10)).resolves.toMatchObject({ status: "failed", code: "HISTORY_SYNC_FAILED" });
    expect(failure).toEqual(["partner_history", "HISTORY_SYNC_FAILED", "network down", 10]);
  });
});
