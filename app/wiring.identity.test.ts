import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";
import { runWithRequestContext } from "~/request-context.server";
import { ShopRepo } from "~/models/shops.server";
import { persistShopIdentity } from "~/wiring.server";

setupTestDatabase();

describe("persistShopIdentity", () => {
  it("uses the already stored immutable shop GID without another Admin API request", async () => {
    await runWithRequestContext(env, async () => {
      const shops = new ShopRepo();
      await shops.recordInstall("one.myshopify.com", 1);
      await shops.recordAuthenticatedIdentity("one.myshopify.com", "gid://shopify/Shop/1", 1);
      let requests = 0;

      await expect(persistShopIdentity({
        graphql: async () => {
          requests += 1;
          return new Response(JSON.stringify({ data: { shop: { id: "gid://shopify/Shop/1", myshopifyDomain: "one.myshopify.com" } } }));
        },
      }, "one.myshopify.com", 2)).resolves.toEqual({ status: "recorded", shopifyShopId: "gid://shopify/Shop/1" });

      expect(requests).toBe(0);
    });
  });

  it("returns a query failure when Shopify responds with HTTP or GraphQL errors", async () => {
    await runWithRequestContext(env, async () => {
      await expect(persistShopIdentity({ graphql: async () => new Response(JSON.stringify({ errors: [{ message: "denied" }] }), { status: 200 }) }, "error.myshopify.com", 2)).resolves.toEqual({ status: "failed", code: "SHOP_IDENTITY_QUERY_FAILED" });
      await expect(persistShopIdentity({ graphql: async () => new Response("unavailable", { status: 503 }) }, "http-error.myshopify.com", 2)).resolves.toEqual({ status: "failed", code: "SHOP_IDENTITY_QUERY_FAILED" });
    });
  });
});
