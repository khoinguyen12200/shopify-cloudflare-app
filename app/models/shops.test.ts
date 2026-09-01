import { describe, it, expect } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";
import { ShopRepo } from "./shops.server";
import type { RelationshipState } from "~/domain/shop-lifecycle";

setupTestDatabase();

/** Model code reads its DB handle from the request context, so tests provide one. */
function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

async function lifecycleRows(shop: string, key: string): Promise<number[]> {
  const rows = await Promise.all([
    env.DB.prepare("SELECT count(*) AS count FROM shops WHERE shop = ?").bind(shop),
    env.DB.prepare("SELECT count(*) AS count FROM webhook_deliveries WHERE shop = ?").bind(shop),
    env.DB.prepare("SELECT count(*) AS count FROM shopify_events WHERE shop = ?").bind(shop),
    env.DB
      .prepare("SELECT count(*) AS count FROM shopify_relationship_events WHERE event_id = ?")
      .bind(`${key}-relationship-event`),
    env.DB
      .prepare("SELECT count(*) AS count FROM shopify_subscription_events WHERE event_id = ?")
      .bind(`${key}-subscription-event`),
    env.DB.prepare("SELECT count(*) AS count FROM shop_subscriptions WHERE shop = ?").bind(shop),
    env.DB
      .prepare("SELECT count(*) AS count FROM shop_subscription_items WHERE shop = ?")
      .bind(shop),
    env.DB.prepare("SELECT count(*) AS count FROM shop_granted_scopes WHERE shop = ?").bind(shop),
    env.DB.prepare("SELECT count(*) AS count FROM shop_scope_changes WHERE shop = ?").bind(shop),
    env.DB
      .prepare("SELECT count(*) AS count FROM shop_scope_change_items WHERE scope_change_id = ?")
      .bind(`${key}-scope-change`),
  ].map((statement) => statement.first<{ count: number }>()));
  return rows.map((row) => Number(row?.count ?? 0));
}

function seedLifecycleRows(shop: string, key: string): Promise<D1Result<unknown>[]> {
  const shopifyShopId = `gid://shopify/Shop/${key}`;
  const relationshipEventId = `${key}-relationship-event`;
  const subscriptionEventId = `${key}-subscription-event`;
  const subscriptionId = `gid://shopify/AppSubscription/${key}`;
  const scopeChangeId = `${key}-scope-change`;

  return env.DB.batch([
    env.DB.prepare("INSERT INTO shops (shop, installed_at) VALUES (?, ?)").bind(shop, 1),
    env.DB
      .prepare(
        "INSERT INTO webhook_deliveries (id, event_id, topic, api_version, shop, triggered_at, received_at, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(`${key}-delivery`, `${key}-delivery-event`, "app/uninstalled", "2026-10", shop, 1, 1, "a".repeat(64)),
    env.DB
      .prepare(
        "INSERT INTO shopify_events (source, event_id, event_type, shop, shopify_shop_id, occurred_at, synchronized_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("partner_history", relationshipEventId, "INSTALLED", shop, shopifyShopId, 1, 1),
    env.DB
      .prepare(
        "INSERT INTO shopify_relationship_events (event_source, event_id, reason, reason_description) VALUES (?, ?, ?, ?)",
      )
      .bind("partner_history", relationshipEventId, "MERCHANT_INSTALL", "The merchant installed the app."),
    env.DB
      .prepare(
        "INSERT INTO shopify_events (source, event_id, event_type, shop, shopify_shop_id, occurred_at, synchronized_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind("partner_history", subscriptionEventId, "CREATED", shop, shopifyShopId, 2, 2),
    env.DB
      .prepare(
        "INSERT INTO shopify_subscription_events (event_source, event_id, subscription_id, status) VALUES (?, ?, ?, ?)",
      )
      .bind("partner_history", subscriptionEventId, subscriptionId, "ACTIVE"),
    env.DB
      .prepare(
        "INSERT INTO shop_subscriptions (shop, subscription_id, status, applied_occurred_at, applied_external_id) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(shop, subscriptionId, "ACTIVE", 2, subscriptionEventId),
    env.DB
      .prepare(
        "INSERT INTO shop_subscription_items (shop, subscription_id, position, item_type) VALUES (?, ?, ?, ?)",
      )
      .bind(shop, subscriptionId, 0, "recurring"),
    env.DB
      .prepare("INSERT INTO shop_granted_scopes (shop, scope, granted_at) VALUES (?, ?, ?)")
      .bind(shop, "read_products", 3),
    env.DB
      .prepare("INSERT INTO shop_scope_changes (id, shop, source, occurred_at) VALUES (?, ?, ?, ?)")
      .bind(scopeChangeId, shop, "webhook", 3),
    env.DB
      .prepare("INSERT INTO shop_scope_change_items (scope_change_id, scope, change) VALUES (?, ?, ?)")
      .bind(scopeChangeId, "read_products", "granted"),
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

    expect(found).toMatchObject({ shop, installedAt: now, uninstalledAt: null });
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

    expect(found?.uninstalledAt).toBe(99);
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
