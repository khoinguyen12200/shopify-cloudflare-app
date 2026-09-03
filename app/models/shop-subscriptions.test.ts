import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { ShopSubscriptionRepo } from "./shop-subscriptions.server";

setupTestDatabase();
const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

describe("ShopSubscriptionRepo", () => {
  it("replaces items and preserves minor-unit money", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("ledger.myshopify.com", {
        type: "CREATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 1, externalId: "evt-1",
        items: [{ itemType: "recurring", priceAmount: 1999, priceCurrency: "USD" }],
      });
      return env.DB.prepare("SELECT price_amount AS amount, price_currency AS currency FROM shop_subscription_items WHERE shop = ?").bind("ledger.myshopify.com").first<{ amount: number; currency: string }>();
    });
    expect(row).toEqual({ amount: 1999, currency: "USD" });
  });

  it("does not regress on an older observation", async () => {
    const result = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("ordered.myshopify.com", { type: "CREATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 2, externalId: "evt-2" });
      return repo.upsertObservation("ordered.myshopify.com", { type: "CANCELED", subscriptionId: "sub-1", occurredAt: 1, externalId: "evt-1" });
    });
    expect(result).toBe("stale");
  });

  it("retries duplicate event to repair missing projection and replaces items", async () => {
    const result = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      const input = { type: "CREATED" as const, status: "ACTIVE" as const, subscriptionId: "sub-1", occurredAt: 1, externalId: "evt-1", items: [{ itemType: "base", priceAmount: 100, priceCurrency: "USD" }] };
      await repo.upsertObservation("repair.myshopify.com", input);
      await env.DB.prepare("DELETE FROM shop_subscription_items WHERE shop = ?").bind("repair.myshopify.com").run();
      await repo.upsertObservation("repair.myshopify.com", { ...input, items: [{ itemType: "base", priceAmount: 200, priceCurrency: "USD" }] });
      return env.DB.prepare("SELECT price_amount AS amount FROM shop_subscription_items WHERE shop = ?").bind("repair.myshopify.com").first<{ amount: number }>();
    });
    expect(result?.amount).toBe(200);
  });

  it("persists every item when a subscription exceeds D1's bind-variable limit", async () => {
    const rows = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      const shop = "many-items.myshopify.com";
      await repo.upsertObservation(shop, {
        type: "CREATED" as const,
        status: "ACTIVE" as const,
        subscriptionId: "sub-1",
        occurredAt: 1,
        externalId: "evt-1",
        items: Array.from({ length: 50 }, (_, position) => ({ itemType: `item-${position}`, priceAmount: position, priceCurrency: "USD" })),
      });
      return env.DB.prepare("SELECT item_type AS itemType, price_amount AS amount FROM shop_subscription_items WHERE shop = ? ORDER BY position")
        .bind(shop).all<{ itemType: string; amount: number }>();
    });
    expect(rows.results).toHaveLength(50);
    expect(rows.results[49]).toEqual({ itemType: "item-49", amount: 49 });
  });

  it("does not replace items after a newer projection wins", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      const shop = "interleaved-items.myshopify.com";
      const old = {
        type: "CREATED" as const,
        status: "ACTIVE" as const,
        subscriptionId: "sub-1",
        occurredAt: 1,
        externalId: "evt-1",
        items: [{ itemType: "old", priceAmount: 100, priceCurrency: "USD" }],
      };
      await repo.upsertObservation(shop, old);
      await env.DB.prepare(`
        CREATE TRIGGER project_newer_subscription_before_item_replacement
        BEFORE DELETE ON shop_subscription_items
        WHEN OLD.shop = 'interleaved-items.myshopify.com'
        BEGIN
          UPDATE shop_subscriptions
          SET applied_occurred_at = 2, applied_external_id = 'evt-2'
          WHERE shop = OLD.shop AND subscription_id = OLD.subscription_id;
          UPDATE shop_subscription_items
          SET item_type = 'new', price_amount = 200
          WHERE shop = OLD.shop AND subscription_id = OLD.subscription_id;
          SELECT RAISE(IGNORE);
        END
      `).run();
      await repo.upsertObservation(shop, old);
      await env.DB.prepare("DROP TRIGGER project_newer_subscription_before_item_replacement").run();
      return env.DB.prepare("SELECT item_type AS itemType, price_amount AS amount FROM shop_subscription_items WHERE shop = ?")
        .bind(shop).first<{ itemType: string; amount: number }>();
    });
    expect(row).toEqual({ itemType: "new", amount: 200 });
  });

  it("preserves metadata when observation omits it", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("metadata.myshopify.com", { type: "CREATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 1, externalId: "evt-1", planHandle: "pro", billingInterval: "EVERY_30_DAYS" });
      await repo.upsertObservation("metadata.myshopify.com", { type: "UPDATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 2, externalId: "evt-2" });
      return repo.get("metadata.myshopify.com", "sub-1");
    });
    expect(row).toMatchObject({ planHandle: "pro", billingInterval: "EVERY_30_DAYS" });
  });

  it("persists current cycle and pending update metadata", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      const input = {
        type: "ACTIVE_SUBSCRIPTION" as const,
        status: "CANCELLATION_SCHEDULED" as const,
        subscriptionId: "sub-1",
        occurredAt: 1,
        externalId: "sub-1",
        currentPeriodStartsAt: 100,
        currentPeriodEndsAt: 200,
        cancellationEffectiveAt: 200,
        pendingPlanHandle: "plus",
        pendingBillingInterval: "ANNUAL",
        pendingLegacySubscriptionId: "gid://shopify/AppSubscription/2",
      };
      await repo.upsertObservation("pending.myshopify.com", input);
      return env.DB.prepare("SELECT current_period_starts_at AS currentPeriodStartsAt, pending_plan_handle AS pendingPlanHandle, pending_billing_interval AS pendingBillingInterval, pending_legacy_subscription_id AS pendingLegacySubscriptionId FROM shop_subscriptions WHERE shop = ?")
        .bind("pending.myshopify.com").first();
    });
    expect(row).toEqual({
      currentPeriodStartsAt: 100,
      pendingPlanHandle: "plus",
      pendingBillingInterval: "ANNUAL",
      pendingLegacySubscriptionId: "gid://shopify/AppSubscription/2",
    });
  });

  it("clears expired active-subscription metadata with explicit nulls", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("clear.myshopify.com", {
        type: "ACTIVE_SUBSCRIPTION", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 1, externalId: "sub-1",
        trialEndsAt: 100, currentPeriodStartsAt: 100, currentPeriodEndsAt: 200,
        pendingPlanHandle: "plus", pendingBillingInterval: "ANNUAL", pendingLegacySubscriptionId: "pending-1",
      });
      await repo.upsertObservation("clear.myshopify.com", {
        type: "ACTIVE_SUBSCRIPTION", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 2, externalId: "sub-1",
        trialEndsAt: null, currentPeriodStartsAt: null, currentPeriodEndsAt: null,
        pendingPlanHandle: null, pendingBillingInterval: null, pendingLegacySubscriptionId: null,
      });
      return repo.get("clear.myshopify.com", "sub-1");
    });
    expect(row).toMatchObject({
      trialEndsAt: null,
      currentPeriodStartsAt: null,
      currentPeriodEndsAt: null,
      pendingPlanHandle: null,
      pendingBillingInterval: null,
      pendingLegacySubscriptionId: null,
    });
  });

  it("retires prior paid projections when active subscription becomes none", async () => {
    const rows = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("retire.myshopify.com", {
        type: "ACTIVE_SUBSCRIPTION", status: "ACTIVE", subscriptionId: "gid://shopify/AppSubscription/1", occurredAt: 1, externalId: "sub-1",
        planHandle: "pro", billingInterval: "EVERY_30_DAYS", items: [{ itemType: "pro", priceAmount: 2900, priceCurrency: "USD" }],
      });
      await repo.upsertObservation("retire.myshopify.com", {
        type: "ACTIVE_SUBSCRIPTION", status: "NONE", subscriptionId: "active:gid://shopify/Shop/1", occurredAt: 2, externalId: "none",
        planHandle: null, billingInterval: null, items: [],
      });
      return repo.listCurrent();
    });
    expect(rows).toMatchObject([{ shop: "retire.myshopify.com", status: "NONE", priceAmount: null, priceCurrency: null }]);
    expect(rows).toHaveLength(1);
  });

  it("returns every recurring pricing item for a current subscription", async () => {
    const rows = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("items.myshopify.com", {
        type: "CREATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 1, externalId: "evt-1",
        items: [
          { itemType: "base", priceAmount: 1900, priceCurrency: "USD" },
          { itemType: "usage", priceAmount: 500, priceCurrency: "USD" },
        ],
      });
      return repo.listCurrent();
    });
    expect(rows).toMatchObject([
      { shop: "items.myshopify.com", priceAmount: 1900, priceCurrency: "USD" },
      { shop: "items.myshopify.com", priceAmount: 500, priceCurrency: "USD" },
    ]);
  });
});
