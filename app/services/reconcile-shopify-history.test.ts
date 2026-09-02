import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { reconcileHistory, type LifecycleLedgerPort, type SyncCheckpointPort } from "./reconcile-shopify-history";
import type { ShopifyPartnerPort } from "~/ports/shopify-partner";
import { ShopifyEventRepo } from "~/models/shopify-events.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { refreshSubscription } from "./reconcile-subscription";

setupTestDatabase();

function event(id: string, occurredAt = "2026-01-01T00:00:00.000Z") {
  return { kind: "relationship" as const, id, occurredAt, shop: "one.myshopify.com", shopId: "gid://shopify/Shop/1", type: "INSTALLED" as const };
}

describe("reconcileHistory", () => {
  it("projects CREATED and CANCELED history into one current row while keeping both ledger facts", async () => {
    await runWithRequestContext(env, async () => {
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop, subscription_id, status, applied_occurred_at, applied_external_id) VALUES (?, ?, ?, ?, ?)")
        .bind("one.myshopify.com", "created-event", "PENDING", 1, "created-event")
        .run();
      const partner: ShopifyPartnerPort = {
        activeSubscription: async () => null,
        listHistoricalEvents: async () => ({
          events: [
            {
              kind: "subscription",
              id: "created-event",
              occurredAt: "2026-01-01T00:00:00.000Z",
              shop: "one.myshopify.com",
              shopId: "gid://shopify/Shop/1",
              type: "CREATED",
              cancelEffectiveOn: null,
              planHandle: "basic",
              billingPeriod: "EVERY_30_DAYS",
            },
            {
              kind: "subscription",
              id: "canceled-event",
              occurredAt: "2026-01-02T00:00:00.000Z",
              shop: "one.myshopify.com",
              shopId: "gid://shopify/Shop/1",
              type: "CANCELED",
              cancelEffectiveOn: "2026-01-02T00:00:00.000Z",
              planHandle: "basic",
              billingPeriod: "EVERY_30_DAYS",
            },
          ],
          hasNextPage: false,
          endCursor: null,
        }),
      };
      const checkpoint: SyncCheckpointPort = {
        readCheckpoint: async () => null,
        markCheckpointSucceeded: async () => undefined,
        markCheckpointFailed: async (...args) => { throw new Error(`unexpected checkpoint failure: ${args.join(" ")}`); },
      };

      await expect(reconcileHistory({
        partner,
        checkpoint,
        ledger: new ShopifyEventRepo(),
        clock: { now: () => 2_000 },
        appId: "app",
      }, 2_000)).resolves.toMatchObject({ status: "succeeded", events: 2 });

      const current = await env.DB.prepare("SELECT subscription_id, status FROM shop_subscriptions WHERE shop = ?")
        .bind("one.myshopify.com")
        .all();
      const history = await env.DB.prepare("SELECT event_id, subscription_id FROM shopify_subscription_events ORDER BY event_id")
        .all();
      expect(current.results).toEqual([{ subscription_id: "active:gid://shopify/Shop/1", status: "CANCELED" }]);
      expect(history.results).toEqual([
        { event_id: "canceled-event", subscription_id: "active:gid://shopify/Shop/1" },
        { event_id: "created-event", subscription_id: "active:gid://shopify/Shop/1" },
      ]);
    });
  });

  it("lets Active Subscription refresh replace the same history projection row", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "refresh.myshopify.com";
      const shopifyShopId = "gid://shopify/Shop/2";
      await env.DB.prepare("INSERT INTO shop_subscriptions (shop, subscription_id, status, applied_occurred_at, applied_external_id) VALUES (?, ?, ?, ?, ?)")
        .bind(shop, "gid://shopify/AppSubscription/old", "CANCELED", 1, "old")
        .run();
      const partner: ShopifyPartnerPort = {
        listHistoricalEvents: async () => ({
          events: [{
            kind: "subscription",
            id: "created-event",
            occurredAt: "2026-01-01T00:00:00.000Z",
            shop,
            shopId: shopifyShopId,
            type: "CREATED",
            cancelEffectiveOn: null,
            planHandle: "basic",
            billingPeriod: "EVERY_30_DAYS",
          }],
          hasNextPage: false,
          endCursor: null,
        }),
        activeSubscription: async () => ({
          shop: { id: shopifyShopId, myshopifyDomain: shop },
          billingPeriod: "EVERY_30_DAYS",
          cancelAtEndOfCycle: false,
          trialEndsAt: null,
          currentBillingCycle: null,
          legacySubscriptionId: "gid://shopify/AppSubscription/7",
          items: [],
          pendingUpdate: null,
        }),
      };
      const subscriptions = new ShopSubscriptionRepo();
      const checkpoint: SyncCheckpointPort = {
        readCheckpoint: async () => null,
        markCheckpointSucceeded: async () => undefined,
        markCheckpointFailed: async (...args) => { throw new Error(`unexpected checkpoint failure: ${args.join(" ")}`); },
      };
      const refreshedAt = Date.parse("2026-01-03T00:00:00.000Z");
      await reconcileHistory({ partner, checkpoint, ledger: new ShopifyEventRepo(), clock: { now: () => refreshedAt - 1 }, appId: "app" }, refreshedAt - 1);
      await expect(refreshSubscription({ partner, subscriptions, clock: { now: () => refreshedAt }, appId: "app" }, { shop, shopifyShopId }, refreshedAt)).resolves.toEqual({ status: "refreshed" });

      const current = await env.DB.prepare("SELECT subscription_id, status FROM shop_subscriptions WHERE shop = ?")
        .bind(shop)
        .all();
      expect(current.results).toEqual([{ subscription_id: `active:${shopifyShopId}`, status: "ACTIVE" }]);
    });
  });

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
    const ledger: LifecycleLedgerPort = {
      recordPartnerRelationship: async (value) => { recorded.push(value.id); return "inserted"; },
      recordPartnerSubscription: async (value) => { recorded.push(value.id); return "inserted"; },
    };
    let success: unknown;
    const checkpoint: SyncCheckpointPort = {
      readCheckpoint: async () => ({ cursor: "old", watermarkAt: 1 }),
      markCheckpointSucceeded: async (...args) => { success = args; },
      markCheckpointFailed: async () => { throw new Error("unexpected"); },
    };

    await expect(reconcileHistory({ partner, checkpoint, ledger, clock: { now: () => 2_000 }, appId: "app" }, 2_000)).resolves.toMatchObject({ status: "succeeded" });
    expect(calls).toEqual([
      { appId: "app", cursor: null, occurredAtMin: "1969-12-31T00:00:00.001Z" },
      { appId: "app", cursor: "next", occurredAtMin: "1969-12-31T00:00:00.001Z" },
    ]);
    expect(recorded).toEqual(["evt-1", "evt-2"]);
    expect(success).toEqual(["partner_history", null, 2000, 2000]);
  });

  it("starts each completed scan at null cursor and records events added between runs", async () => {
    const calls: Parameters<ShopifyPartnerPort["listHistoricalEvents"]>[0][] = [];
    const partner: ShopifyPartnerPort = {
      activeSubscription: async () => null,
      listHistoricalEvents: async (input) => {
        calls.push(input);
        if (calls.length === 1) return { events: [event("existing")], hasNextPage: false, endCursor: "completed-run-1" };
        return input.cursor === null
          ? { events: [event("new")], hasNextPage: false, endCursor: "completed-run-2" }
          : { events: [], hasNextPage: false, endCursor: "completed-run-2" };
      },
    };
    const recorded: string[] = [];
    const ledger: LifecycleLedgerPort = {
      recordPartnerRelationship: async (value) => { recorded.push(value.id); return "inserted"; },
      recordPartnerSubscription: async () => "inserted",
    };
    let checkpoint: { cursor: string | null; watermarkAt: number | null } | null = { cursor: "old-run", watermarkAt: 1 };
    const checkpointPort: SyncCheckpointPort = {
      readCheckpoint: async () => checkpoint,
      markCheckpointSucceeded: async (_name, cursor, watermarkAt) => { checkpoint = { cursor, watermarkAt }; },
      markCheckpointFailed: async () => { throw new Error("unexpected"); },
    };

    await reconcileHistory({ partner, checkpoint: checkpointPort, ledger, clock: { now: () => 2_000 }, appId: "app" }, 2_000);
    await reconcileHistory({ partner, checkpoint: checkpointPort, ledger, clock: { now: () => 3_000 }, appId: "app" }, 3_000);

    expect(calls.map(({ cursor }) => cursor)).toEqual([null, null]);
    expect(recorded).toEqual(["existing", "new"]);
    expect(checkpoint).toEqual({ cursor: null, watermarkAt: 3_000 });
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
    await expect(reconcileHistory({ partner, checkpoint, ledger: {
      recordPartnerRelationship: async () => "inserted",
      recordPartnerSubscription: async () => "inserted",
    }, clock: { now: () => 10 }, appId: "app" }, 10)).resolves.toMatchObject({ status: "failed", code: "HISTORY_SYNC_FAILED" });
    expect(failure).toEqual(["partner_history", "HISTORY_SYNC_FAILED", "network down", 10]);
  });
});
