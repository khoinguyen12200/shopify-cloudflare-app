import { describe, it, expect } from "vitest";
import { pricingPlansUrl } from "./pricing-plans-url";

describe("pricingPlansUrl", () => {
  it("builds the hosted Managed Pricing URL from the shop and app handle", () => {
    expect(pricingPlansUrl("cool-shop.myshopify.com", "my-app")).toBe(
      "https://admin.shopify.com/store/cool-shop/charges/my-app/pricing_plans",
    );
  });
});
