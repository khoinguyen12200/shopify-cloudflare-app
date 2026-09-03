import { describe, expect, it } from "vitest";
import { reconcileAfterUninstall } from "./reconcile-after-uninstall";

describe("reconcileAfterUninstall", () => {
  it("refreshes both authoritative subscription state and immutable history", async () => {
    const calls: string[] = [];
    await expect(reconcileAfterUninstall({
      refreshSubscription: async () => { calls.push("subscription"); return { status: "refreshed" }; },
      refreshHistory: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 1 }; },
    })).resolves.toEqual({ ok: true });
    expect(calls.sort()).toEqual(["history", "subscription"]);
  });

  it("returns an observable failure so the queue retries", async () => {
    await expect(reconcileAfterUninstall({
      refreshSubscription: async () => ({ status: "failed", code: "DENIED", detail: "Manage apps required" }),
      refreshHistory: async () => ({ status: "succeeded", pages: 1, events: 1 }),
    })).resolves.toEqual({ ok: false, code: "DENIED", detail: "Manage apps required" });
  });
});
