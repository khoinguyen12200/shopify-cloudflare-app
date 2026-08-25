import { describe, it, expect } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";
import { SubscriptionEventRepo } from "./subscription-events.server";
import type { SubscriptionEventInput } from "~/billing/subscription-event";

setupTestDatabase();

function inRequest<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(env, fn);
}

function event(overrides: Partial<SubscriptionEventInput> = {}): SubscriptionEventInput {
  return {
    subscriptionId: "gid://shopify/AppSubscription/1",
    name: "TODO:PRO",
    status: "ACTIVE",
    planHandle: "todo-pro",
    interval: "every_30_days",
    price: { amount: 1900, currency: "USD" } as SubscriptionEventInput["price"],
    cappedAmount: null,
    shopifyCreatedAt: 1_700_000_000_000,
    shopifyUpdatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("SubscriptionEventRepo", () => {
  it("records a new event and returns it in that shop's history", async () => {
    const shop = "record.myshopify.com";

    const history = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      await repo.record(shop, "evt-1", event(), 1_700_000_100_000);
      return repo.listForShop(shop);
    });

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      shop,
      subscriptionId: "gid://shopify/AppSubscription/1",
      status: "ACTIVE",
      priceAmount: 1900,
      priceCurrency: "USD",
    });
  });

  it("is idempotent — a replayed delivery for the same update does not duplicate", async () => {
    const shop = "replay.myshopify.com";

    const history = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      const e = event();
      await repo.record(shop, "evt-a", e, 1_700_000_100_000);
      // Same subscriptionId + same shopifyUpdatedAt = the same event, re-delivered.
      await repo.record(shop, "evt-a-retry", e, 1_700_000_200_000);
      return repo.listForShop(shop);
    });

    expect(history).toHaveLength(1);
  });

  it("records a genuinely new update as a second row, preserving history", async () => {
    const shop = "history.myshopify.com";

    const history = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      await repo.record(shop, "evt-1", event({ status: "ACTIVE", shopifyUpdatedAt: 1 }), 10);
      await repo.record(
        shop,
        "evt-2",
        event({ status: "CANCELLED", shopifyUpdatedAt: 2 }),
        20,
      );
      return repo.listForShop(shop);
    });

    expect(history).toHaveLength(2);
    // Newest first.
    expect(history[0]?.status).toBe("CANCELLED");
    expect(history[1]?.status).toBe("ACTIVE");
  });

  it("scopes history to the shop it belongs to", async () => {
    const result = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      await repo.record("mine.myshopify.com", "evt-1", event(), 1);
      await repo.record("theirs.myshopify.com", "evt-2", event(), 2);
      return repo.listForShop("mine.myshopify.com");
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.shop).toBe("mine.myshopify.com");
  });

  it("reports the latest event for a shop", async () => {
    const shop = "latest.myshopify.com";

    const latest = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      await repo.record(shop, "evt-1", event({ status: "PENDING", shopifyUpdatedAt: 1 }), 1);
      await repo.record(shop, "evt-2", event({ status: "ACTIVE", shopifyUpdatedAt: 2 }), 2);
      return repo.latestForShop(shop);
    });

    expect(latest?.status).toBe("ACTIVE");
  });

  it("maps every shop to its own latest event, in one query", async () => {
    const map = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      await repo.record("a.myshopify.com", "evt-1", event({ status: "PENDING", shopifyUpdatedAt: 1 }), 1);
      await repo.record("a.myshopify.com", "evt-2", event({ status: "ACTIVE", shopifyUpdatedAt: 2 }), 2);
      await repo.record("b.myshopify.com", "evt-3", event({ status: "CANCELLED", shopifyUpdatedAt: 5 }), 5);
      return repo.latestPerShop();
    });

    expect(map.get("a.myshopify.com")?.status).toBe("ACTIVE");
    expect(map.get("b.myshopify.com")?.status).toBe("CANCELLED");
    expect(map.has("c.myshopify.com")).toBe(false);
  });

  it("lists the most recent events across every shop, newest first", async () => {
    const recent = await inRequest(async () => {
      const repo = new SubscriptionEventRepo();
      await repo.record("a.myshopify.com", "evt-1", event({ shopifyUpdatedAt: 1 }), 1);
      await repo.record("b.myshopify.com", "evt-2", event({ shopifyUpdatedAt: 2 }), 2);
      return repo.listRecent(10);
    });

    expect(recent.map((e) => e.shop)).toEqual(["b.myshopify.com", "a.myshopify.com"]);
  });
});
