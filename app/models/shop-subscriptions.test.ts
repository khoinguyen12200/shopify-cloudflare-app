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

  it("preserves metadata when observation omits it", async () => {
    const row = await inRequest(async () => {
      const repo = new ShopSubscriptionRepo();
      await repo.upsertObservation("metadata.myshopify.com", { type: "CREATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 1, externalId: "evt-1", planHandle: "pro", billingInterval: "EVERY_30_DAYS" });
      await repo.upsertObservation("metadata.myshopify.com", { type: "UPDATED", status: "ACTIVE", subscriptionId: "sub-1", occurredAt: 2, externalId: "evt-2" });
      return repo.get("metadata.myshopify.com", "sub-1");
    });
    expect(row).toMatchObject({ planHandle: "pro", billingInterval: "EVERY_30_DAYS" });
  });
});
