import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { ShopifyPartnerAdapter } from "~/adapters/shopify-partner.server";
import { ShopifyEventRepo } from "~/models/shopify-events.server";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { reconcileShopHistory } from "./reconcile-shopify-history";
import { refreshSubscription } from "./reconcile-subscription";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";

setupTestDatabase();

describe("cancellation history metadata", () => {
  it("clears obsolete cancellation date and pending metadata on authoritative resume", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "resume.myshopify.com";
      const shopifyShopId = "gid://shopify/Shop/2";
      await env.DB.prepare(`INSERT INTO shop_subscriptions
        (shop,subscription_id,status,applied_occurred_at,applied_external_id,cancel_effective_on,cancellation_effective_at,pending_plan_handle)
        VALUES (?,?,'CANCELLATION_SCHEDULED',1,'old','2026-10-01',100000,'basic')`)
        .bind(shop, `active:${shopifyShopId}`).run();
      const partner = new ShopifyPartnerAdapter({ token: "test", organizationId: "1", apiVersion: "2026-07",
        fetch: async () => Response.json({ data: { activeSubscription: {
          shop: { id: shopifyShopId, myshopifyDomain: shop }, billingPeriod: "EVERY_30_DAYS",
          cancelAtEndOfCycle: false, trialEndsAt: null, currentBillingCycle: null,
          legacySubscriptionId: null, items: [], pendingUpdate: null,
        } } }),
      });
      expect(await refreshSubscription({ partner, subscriptions: new ShopSubscriptionRepo(),
        clock: { now: () => 2 }, appId: "app",
      }, { shop, shopifyShopId }, 2)).toEqual({ status: "refreshed" });
      expect(await env.DB.prepare("SELECT * FROM shop_subscriptions WHERE shop = ?").bind(shop).first())
        .toMatchObject({ status: "ACTIVE", cancel_effective_on: null, cancellation_effective_at: null, pending_plan_handle: null });
    });
  });
  it("persists the date-only cancellation fact without inventing an effective instant", async () => {
    await runWithRequestContext(env, async () => {
      const shop = "cancel.myshopify.com";
      const shopifyShopId = "gid://shopify/Shop/1";
      const partner = new ShopifyPartnerAdapter({
        token: "test", organizationId: "1", apiVersion: "2026-07",
        fetch: async () => Response.json({ data: { events: {
          edges: [{ node: {
            id: "scheduled", eventType: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
            occurredAt: "2026-09-01T12:00:00Z", subscriptionState: "CANCELLATION_SCHEDULED",
            shop: { id: shopifyShopId, myshopifyDomain: shop },
            cancelEffectiveOn: "2026-10-01", plan: { handle: "pro", billingPeriod: "EVERY_30_DAYS" },
          } }], pageInfo: { hasNextPage: false, endCursor: null },
        } } }),
      });
      const now = Date.parse("2026-09-02T00:00:00Z");
      expect(await reconcileShopHistory({ partner, ledger: new ShopifyEventRepo(),
        clock: { now: () => now }, appId: "app",
      }, { shop, shopifyShopId }, now)).toMatchObject({ status: "succeeded" });
      const current = await env.DB.prepare("SELECT * FROM shop_subscriptions WHERE shop = ?").bind(shop).first();
      const event = await env.DB.prepare("SELECT * FROM shopify_subscription_events WHERE event_id = ?").bind("scheduled").first();
      expect(current).toMatchObject({ cancel_effective_on: "2026-10-01", cancellation_effective_at: null });
      expect(event).toMatchObject({ cancel_effective_on: "2026-10-01", cancellation_effective_at: null });
    });
  });
});
