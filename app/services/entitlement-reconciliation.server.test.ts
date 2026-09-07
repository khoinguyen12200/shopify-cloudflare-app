import { describe, expect, it } from "vitest";
import { reconcileHeld, type HeldReconciliationPort } from "./entitlement-reconciliation.server";

describe("reconcileHeld", () => {
  it("applies explicit decisions and preserves shop scope", async () => {
    const calls: string[] = [];
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => [{ kind: "quota", id: "op-1", shop }],
      apply: async (item, decision) => { calls.push(`${item.shop}:${item.id}:${decision}`); return { state: decision === "commit" ? "committed" : "released" }; },
    };
    const result = await reconcileHeld("shop-1", port, (item) => item.id === "op-1" ? "release" : "ignore");
    expect(result).toEqual({ processed: 1, released: 1, committed: 0 });
    expect(calls).toEqual(["shop-1:op-1:release"]);
  });
});
