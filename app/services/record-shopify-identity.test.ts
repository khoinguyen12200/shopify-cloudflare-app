import { describe, expect, it } from "vitest";
import { recordShopifyIdentity } from "./record-shopify-identity";

describe("recordShopifyIdentity", () => {
  it("stores the Admin API shop GID only when its domain matches the authenticated session", async () => {
    const recorded: Array<{ shop: string; shopifyShopId: string; now: number }> = [];

    await expect(recordShopifyIdentity({
      shop: "one.myshopify.com",
      queryShop: async () => ({ id: "gid://shopify/Shop/1", myshopifyDomain: "one.myshopify.com" }),
      record: async (shop, shopifyShopId, now) => { recorded.push({ shop, shopifyShopId, now }); },
    }, 100)).resolves.toEqual({ status: "recorded", shopifyShopId: "gid://shopify/Shop/1" });

    expect(recorded).toEqual([{ shop: "one.myshopify.com", shopifyShopId: "gid://shopify/Shop/1", now: 100 }]);
  });

  it("refuses an Admin response for another shop", async () => {
    await expect(recordShopifyIdentity({
      shop: "one.myshopify.com",
      queryShop: async () => ({ id: "gid://shopify/Shop/2", myshopifyDomain: "other.myshopify.com" }),
      record: async () => undefined,
    }, 100)).resolves.toEqual({ status: "failed", code: "SHOP_IDENTITY_MISMATCH" });
  });

  it("returns an observable failure when Shopify cannot provide identity", async () => {
    await expect(recordShopifyIdentity({
      shop: "one.myshopify.com",
      queryShop: async () => { throw new Error("Shopify unavailable"); },
      record: async () => undefined,
    }, 100)).resolves.toEqual({ status: "failed", code: "SHOP_IDENTITY_QUERY_FAILED" });
  });
});
