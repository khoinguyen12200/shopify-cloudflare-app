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
});
