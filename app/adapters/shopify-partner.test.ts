import { describe, expect, it } from "vitest";
import { ShopifyPartnerAdapter } from "./shopify-partner.server";

describe("ShopifyPartnerAdapter", () => {
  it("reads active subscription through Partner GraphQL", async () => {
    const calls: Request[] = [];
    const adapter = new ShopifyPartnerAdapter({
      token: "token",
      fetch: async (input, init) => {
        calls.push(new Request(input, init));
        return new Response(JSON.stringify({ data: { activeSubscription: null } }), { status: 200 });
      },
    });

    await expect(adapter.activeSubscription("app", "shop")).resolves.toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.get("X-Shopify-Access-Token")).toBe("token");
  });
});
