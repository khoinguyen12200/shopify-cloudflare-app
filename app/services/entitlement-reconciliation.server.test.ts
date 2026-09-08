import { describe, expect, it } from "vitest";
import { reconcileHeld, type HeldReconciliationPort } from "./entitlement-reconciliation.server";

describe("reconcileHeld", () => {
  it("awaits asynchronous ownership decisions before settlement", async () => {
    let held = true;
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => [{ kind: "quota", id: "op", key: "exports", shop }],
      apply: async () => { held = false; return { state: "committed" }; },
    };
    const result = await reconcileHeld("shop", port, async () => "commit" as const);
    expect(result).toEqual({ processed: 1, committed: 1, allocated: 0, released: 0, failures: [] });
    expect(held).toBe(false);
  });
  it("applies explicit decisions and preserves shop scope", async () => {
    const calls: string[] = [];
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => [{ kind: "quota", id: "op-1", key: "exports", shop }],
      apply: async (shop, item, decision) => { calls.push(`${shop}:${item.id}:${decision}`); return { state: decision === "commit" ? "committed" : "released" }; },
    };
    const result = await reconcileHeld("shop-1", port, (item) => item.id === "op-1" ? "release" : "ignore");
    expect(result).toEqual({ processed: 1, released: 1, committed: 0, allocated: 0, failures: [] });
    expect(calls).toEqual(["shop-1:op-1:release"]);
  });

  it("counts confirmed capacity separately and retains failed decisions", async () => {
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => [
        { kind: "capacity", key: "staff.max", id: "staff-1", shop },
        { kind: "quota", key: "exports", id: "failed", shop },
        { kind: "quota", key: "exports", id: "unknown-owner", shop },
      ],
      apply: async (_shop, item) => item.kind === "capacity" ? { state: "allocated" } : { reason: "invalid_state" },
    };
    expect(await reconcileHeld("shop-1", port, (item) => item.kind === "capacity" ? "allocate" : item.id === "failed" ? "commit" : "ignore")).toEqual({
      processed: 1, committed: 0, allocated: 1, released: 0, failures: [{ id: "failed", key: "exports", reason: "invalid_state" }],
    });
  });

  it("rejects a quota decision for capacity without applying it", async () => {
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => [{ kind: "capacity", key: "staff.max", id: "staff-1", shop }],
      apply: async () => { throw new Error("invalid decision reached adapter"); },
    };
    expect(await reconcileHeld("shop-1", port, () => "commit")).toEqual({
      processed: 0, committed: 0, allocated: 0, released: 0, failures: [{ id: "staff-1", key: "staff.max", reason: "invalid_decision" }],
    });
  });
});
