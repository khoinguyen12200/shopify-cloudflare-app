import { describe, expect, it } from "vitest";
import { reconcileShop } from "./reconcile-shop";

describe("reconcileShop", () => {
  it("refreshes current billing state and immutable history together", async () => {
    const calls: string[] = [];

    await expect(reconcileShop({
      refreshSubscription: async () => { calls.push("subscription"); return { status: "refreshed" }; },
      refreshHistory: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 1 }; },
    })).resolves.toEqual({ status: "succeeded" });

    expect(calls.sort()).toEqual(["history", "subscription"]);
  });

  it("returns the subscription refresh failure for the caller to handle", async () => {
    await expect(reconcileShop({
      refreshSubscription: async () => ({ status: "failed", code: "DENIED", detail: "Manage apps required" }),
      refreshHistory: async () => ({ status: "succeeded", pages: 1, events: 1 }),
    })).resolves.toEqual({ status: "failed", code: "DENIED", detail: "Manage apps required" });
  });
});
