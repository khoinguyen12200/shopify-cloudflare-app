import { eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
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
      await makeDb(env.DB).insert(schema.shopSubscriptions).values({ shop, subscriptionId: `active:${shopifyShopId}`, status: "CANCELLATION_SCHEDULED", appliedOccurredAt: 1, appliedExternalId: "old", cancelEffectiveOn: "2026-10-01", cancellationEffectiveAt: 100000, pendingPlanHandle: "basic" }).run();
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
      expect(await makeDb(env.DB).select().from(schema.shopSubscriptions).where(eq(schema.shopSubscriptions.shop, shop)).get())
        .toMatchObject({ status: "ACTIVE", cancelEffectiveOn: null, cancellationEffectiveAt: null, pendingPlanHandle: null });
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
      const current = await makeDb(env.DB).select().from(schema.shopSubscriptions).where(eq(schema.shopSubscriptions.shop, shop)).get();
      const event = await makeDb(env.DB).select().from(schema.shopifySubscriptionEvents).where(eq(schema.shopifySubscriptionEvents.eventId, "scheduled")).get();
      expect(current).toMatchObject({ cancelEffectiveOn: "2026-10-01", cancellationEffectiveAt: null });
      expect(event).toMatchObject({ cancelEffectiveOn: "2026-10-01", cancellationEffectiveAt: null });
    });
  });
});
