import { drizzle } from "drizzle-orm/d1";
import { count, eq } from "drizzle-orm";
import { shopGrantedScopes, shopScopeChangeItems, shopScopeChanges, shopSubscriptionItems, shopSubscriptions, shopifyEvents, shopifyRelationshipEvents, shopifySubscriptionEvents, shops, webhookDeliveries } from "~/db/schema";
import { describe, it, expect } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "./shops.server";
import type { RelationshipState } from "~/domain/shop-lifecycle";

setupTestDatabase();

const db = drizzle(env.DB);

/** Model code reads its DB handle from the request context, so tests provide one. */
function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

async function lifecycleRows(shop: string, key: string): Promise<number[]> {
  const rows = await Promise.all([
    db.select({ count: count() }).from(shops).where(eq(shops.shop, shop)).get(),
    db.select({ count: count() }).from(webhookDeliveries).where(eq(webhookDeliveries.shop, shop)).get(),
    db.select({ count: count() }).from(shopifyEvents).where(eq(shopifyEvents.shop, shop)).get(),
    db.select({ count: count() }).from(shopifyRelationshipEvents).where(eq(shopifyRelationshipEvents.eventId, `${key}-relationship-event`)).get(),
    db.select({ count: count() }).from(shopifySubscriptionEvents).where(eq(shopifySubscriptionEvents.eventId, `${key}-subscription-event`)).get(),
    db.select({ count: count() }).from(shopSubscriptions).where(eq(shopSubscriptions.shop, shop)).get(),
    db.select({ count: count() }).from(shopSubscriptionItems).where(eq(shopSubscriptionItems.shop, shop)).get(),
    db.select({ count: count() }).from(shopGrantedScopes).where(eq(shopGrantedScopes.shop, shop)).get(),
    db.select({ count: count() }).from(shopScopeChanges).where(eq(shopScopeChanges.shop, shop)).get(),
    db.select({ count: count() }).from(shopScopeChangeItems).where(eq(shopScopeChangeItems.scopeChangeId, `${key}-scope-change`)).get(),
  ]);
  return rows.map((row) => Number(row?.count ?? 0));
}

function seedLifecycleRows(shop: string, key: string) {
  const shopifyShopId = `gid://shopify/Shop/${key}`;
  const relationshipEventId = `${key}-relationship-event`;
  const subscriptionEventId = `${key}-subscription-event`;
  const subscriptionId = `gid://shopify/AppSubscription/${key}`;
  const scopeChangeId = `${key}-scope-change`;

  return db.batch([
    db.insert(shops).values({ shop: shop, installedAt: 1 }),
    db.insert(webhookDeliveries).values({ id: `${key}-delivery`, eventId: `${key}-delivery-event`, topic: "app/uninstalled", apiVersion: "2026-10", shop: shop, triggeredAt: 1, receivedAt: 1, payloadHash: "a".repeat(64) }),
    db.insert(shopifyEvents).values({ source: "partner_history", eventId: relationshipEventId, eventType: "INSTALLED", shop: shop, shopifyShopId: shopifyShopId, occurredAt: 1, synchronizedAt: 1 }),
    db.insert(shopifyRelationshipEvents).values({ eventSource: "partner_history", eventId: relationshipEventId, reason: "MERCHANT_INSTALL", reasonDescription: "The merchant installed the app." }),
    db.insert(shopifyEvents).values({ source: "partner_history", eventId: subscriptionEventId, eventType: "CREATED", shop: shop, shopifyShopId: shopifyShopId, occurredAt: 2, synchronizedAt: 2 }),
    db.insert(shopifySubscriptionEvents).values({ eventSource: "partner_history", eventId: subscriptionEventId, subscriptionId: subscriptionId, status: "ACTIVE" }),
    db.insert(shopSubscriptions).values({ shop: shop, subscriptionId: subscriptionId, status: "ACTIVE", appliedOccurredAt: 2, appliedExternalId: subscriptionEventId }),
    db.insert(shopSubscriptionItems).values({ shop: shop, subscriptionId: subscriptionId, position: 0, itemType: "recurring" }),
    db.insert(shopGrantedScopes).values({ shop: shop, scope: "read_products", grantedAt: 3 }),
    db.insert(shopScopeChanges).values({ id: scopeChangeId, shop: shop, source: "webhook", occurredAt: 3 }),
    db.insert(shopScopeChangeItems).values({ scopeChangeId: scopeChangeId, scope: "read_products", change: "granted" }),
  ]);
}

describe("ShopRepo", () => {
  it("returns undefined for a shop it has never seen", async () => {
    const found = await inRequest(() => new ShopRepo().get("nope.myshopify.com"));
    expect(found).toBeUndefined();
  });

  it("records an install", async () => {
    const shop = "install.myshopify.com";
    const now = 1_700_000_000_000;

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, now);
      return repo.get(shop);
    });

    expect(found).toMatchObject({ shop, installedAt: now, uninstalledAt: null, currentInstalledAt: now, relationshipStatus: "INSTALLED", relationshipOccurredAt: now });
  });

  it("is idempotent across a repeated install", async () => {
    const shop = "repeat.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await repo.recordInstall(shop, 2);
      return repo.get(shop);
    });

    // The original install time is preserved; the row is revived, not replaced.
    expect(found?.installedAt).toBe(1);
  });

  it("clears uninstalledAt when a shop reinstalls", async () => {
    const shop = "reinstall.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await repo.recordUninstall(shop, 2);
      await repo.recordInstall(shop, 3);
      return repo.get(shop);
    });

    expect(found?.uninstalledAt).toBeNull();
  });

  it("records an uninstall", async () => {
    const shop = "gone.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall(shop, 1);
      await repo.recordUninstall(shop, 99);
      return repo.get(shop);
    });

    expect(found).toMatchObject({ uninstalledAt: 99, currentInstalledAt: null, relationshipStatus: "UNINSTALLED", relationshipOccurredAt: 99 });
  });

  it("lists every shop, newest install first", async () => {
    const list = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.recordInstall("older.myshopify.com", 1);
      await repo.recordInstall("newer.myshopify.com", 2);
      return repo.listAll();
    });

    expect(list.map((s) => s.shop)).toEqual([
      "newer.myshopify.com",
      "older.myshopify.com",
    ]);
  });

  it("keeps the newest ordered relationship transition as the shop projection", async () => {
    const shop = "projection.myshopify.com";
    const installed: RelationshipState = {
      kind: "installed",
      occurredAt: 200,
      externalId: "event-2",
    };
    const staleUninstall: RelationshipState = {
      kind: "uninstalled",
      occurredAt: 100,
      externalId: "event-1",
    };

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.applyRelationship(shop, installed, "gid://shopify/Shop/projection");
      await repo.applyRelationship(shop, staleUninstall, "gid://shopify/Shop/projection");
      return repo.get(shop);
    });

    expect(found).toMatchObject({
      shop,
      relationshipStatus: "INSTALLED",
      relationshipOccurredAt: 200,
      relationshipExternalId: "event-2",
    });
  });

  it("repairs first install after newer relationship history has arrived", async () => {
    const shop = "out-of-order.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.applyRelationship(shop, {
        kind: "uninstalled",
        occurredAt: 300,
        externalId: "event-3",
      }, "gid://shopify/Shop/out-of-order");
      await repo.applyRelationship(shop, {
        kind: "reactivated",
        occurredAt: 400,
        externalId: "event-4",
      }, "gid://shopify/Shop/out-of-order");
      await repo.applyRelationship(shop, {
        kind: "installed",
        occurredAt: 100,
        externalId: "event-1",
      }, "gid://shopify/Shop/out-of-order");
      return repo.get(shop);
    });

    expect(found).toMatchObject({
      installedAt: 100,
      currentInstalledAt: 400,
      relationshipStatus: "REACTIVATED",
      relationshipOccurredAt: 400,
      relationshipExternalId: "event-4",
    });
  });

  it("records the authoritative Shopify shop ID on the relationship projection", async () => {
    const shop = "stable-id.myshopify.com";

    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      await repo.applyRelationship(
        shop,
        {
          kind: "installed",
          occurredAt: 100,
          externalId: "event-1",
        },
        "gid://shopify/Shop/123",
      );
      return repo.get(shop);
    });

    expect(found).toMatchObject({ shopifyShopId: "gid://shopify/Shop/123" });
  });

  it("purges every Task 2 lifecycle row for only the requested shop", async () => {
    const purged = await inRequest(async () => {
      await seedLifecycleRows("erased.myshopify.com", "erased");
      await seedLifecycleRows("retained.myshopify.com", "retained");
      return new ShopRepo().purge("erased.myshopify.com");
    });

    expect(purged).toBe(11);
    await expect(lifecycleRows("erased.myshopify.com", "erased")).resolves.toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await expect(lifecycleRows("retained.myshopify.com", "retained")).resolves.toEqual([
      1, 1, 2, 1, 1, 1, 1, 1, 1, 1,
    ]);
  });

  it("does not read a relationship projection through a different shop key", async () => {
    const found = await inRequest(async () => {
      const repo = new ShopRepo();
      const relationship: RelationshipState = {
        kind: "installed",
        occurredAt: 100,
        externalId: "event-1",
      };
      await repo.applyRelationship(
        "mine.myshopify.com",
        relationship,
        "gid://shopify/Shop/mine",
      );
      return repo.get("theirs.myshopify.com");
    });

    expect(found).toBeUndefined();
  });
});
