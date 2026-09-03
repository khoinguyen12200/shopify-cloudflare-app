import { describe, expect, it } from "vitest";
import { reconcilePricingReturn } from "./reconcile-pricing-return";

describe("reconcilePricingReturn", () => {
  it("refreshes both the current projection and immutable history after Shopify pricing returns", async () => {
    const calls: string[] = [];

    await reconcilePricingReturn(
      "https://app.example.com/app?plan_handle=free",
      {
        refreshSubscription: async () => { calls.push("subscription"); return { status: "refreshed" as const }; },
        refreshHistory: async () => { calls.push("history"); return { status: "succeeded" as const, pages: 1, events: 1 }; },
      },
    );

    expect(calls).toEqual(["subscription", "history"]);
  });

  it("does not contact Partner APIs on normal navigation", async () => {
    const calls: string[] = [];

    await reconcilePricingReturn(
      "https://app.example.com/app?shop=one.myshopify.com",
      {
        refreshSubscription: async () => { calls.push("subscription"); return { status: "refreshed" as const }; },
        refreshHistory: async () => { calls.push("history"); return { status: "succeeded" as const, pages: 1, events: 1 }; },
      },
    );

    expect(calls).toEqual([]);
  });

  it("fails when Shopify truth cannot be refreshed", async () => {
    await expect(reconcilePricingReturn("https://app.example.com/app?plan_handle=pro", {
      refreshSubscription: async () => ({ status: "failed", code: "DENIED", detail: "Manage apps required" }),
      refreshHistory: async () => ({ status: "succeeded", pages: 1, events: 0 }),
    })).rejects.toThrow("Manage apps required");
  });

});
