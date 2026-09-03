import { describe, expect, it } from "vitest";
import { isPricingReturn } from "./pricing-return";
import { pricingReturnDestination } from "./pricing-return";

describe("isPricingReturn", () => {
  it("recognizes Shopify's non-empty plan_handle return parameter", () => {
    expect(isPricingReturn("https://app.example.com/app?plan_handle=pro")).toBe(true);
  });

  it("does not refresh on normal app navigation", () => {
    expect(isPricingReturn("https://app.example.com/app?shop=example.myshopify.com")).toBe(false);
  });

  it("does not treat an empty plan handle as a pricing return", () => {
    expect(isPricingReturn("https://app.example.com/app?plan_handle=%20%20")).toBe(false);
  });
});

describe("pricingReturnDestination", () => {
  it("preserves the hosted-pricing return trigger when sending it to billing", () => {
    expect(pricingReturnDestination("https://app.example.com/app?charge_id=1&plan_handle=pro")).toBe("/app/billing?plan_handle=pro");
  });

  it("does not redirect ordinary app navigation", () => {
    expect(pricingReturnDestination("https://app.example.com/app?shop=one.myshopify.com")).toBeNull();
  });
});
