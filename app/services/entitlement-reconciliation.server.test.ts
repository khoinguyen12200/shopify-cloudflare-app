import { describe, expect, it } from "vitest";
import { reconcileHeld, type HeldReconciliationPort } from "./entitlement-reconciliation.server";

const item = (overrides: Record<string, unknown> = {}) => ({
  kind: "quota" as const,
  id: "op",
  key: "exports",
  shop: "shop",
  createdAt: 1,
  ...overrides,
});

describe("reconcileHeld", () => {
  it("awaits asynchronous ownership decisions before settlement", async () => {
    let held = true;
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => ({ items: [item({ shop })] }),
      apply: async () => { held = false; return { state: "committed" }; },
    };
    const result = await reconcileHeld("shop", port, async () => "commit" as const);
    expect(result).toEqual({ processed: 1, committed: 1, allocated: 0, released: 0, failures: [] });
    expect(held).toBe(false);
  });

  it("applies explicit decisions and preserves shop scope", async () => {
    const calls: string[] = [];
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => ({ items: [item({ shop, id: "op-1" })] }),
      apply: async (shop, held, decision) => { calls.push(`${shop}:${held.id}:${decision}`); return { state: decision === "commit" ? "committed" : "released" }; },
    };
    const result = await reconcileHeld("shop-1", port, (held) => held.id === "op-1" ? "release" as const : "ignore" as const);
    expect(result).toEqual({ processed: 1, released: 1, committed: 0, allocated: 0, failures: [] });
    expect(calls).toEqual(["shop-1:op-1:release"]);
  });

  it("counts confirmed capacity separately and retains failed decisions", async () => {
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => ({ items: [
        item({ kind: "capacity", key: "staff.max", id: "staff-1", shop }),
        item({ id: "failed", shop }),
        item({ id: "unknown-owner", shop }),
      ] }),
      apply: async (_shop, held) => held.kind === "capacity" ? { state: "allocated" } : { reason: "invalid_state" },
    };
    expect(await reconcileHeld("shop-1", port, (held) => held.kind === "capacity" ? "confirm" : held.id === "failed" ? "commit" : "ignore")).toEqual({
      processed: 1, committed: 0, allocated: 1, released: 0, failures: [{ id: "failed", key: "exports", reason: "invalid_state" }],
    });
  });

  it("rejects a quota decision for capacity without applying it", async () => {
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => ({ items: [item({ kind: "capacity", key: "staff.max", id: "staff-1", shop })] }),
      apply: async () => { throw new Error("invalid decision reached adapter"); },
    };
    expect(await reconcileHeld("shop-1", port, () => "commit")).toEqual({
      processed: 0, committed: 0, allocated: 0, released: 0, failures: [{ id: "staff-1", key: "staff.max", reason: "invalid_decision" }],
    });
  });

  it("returns a continuation cursor when the processing limit stops a page", async () => {
    const port: HeldReconciliationPort = {
      listHeld: async () => ({ items: [item({ shop: "shop-1" })], nextCursor: "cursor-2" }),
      apply: async () => ({ state: "released" }),
    };
    await expect(reconcileHeld("shop-1", port, () => "release", { limit: 1 })).resolves.toMatchObject({ processed: 1, nextCursor: "cursor-2" });
  });

  it("passes measured quota usage to the settlement port", async () => {
    const calls: Array<number | undefined> = [];
    const port: HeldReconciliationPort = {
      listHeld: async (shop) => ({ items: [item({ shop, amount: 4 })] }),
      apply: async (_shop, _held, _decision, actualAmount) => {
        calls.push(actualAmount);
        return { state: "committed" };
      },
    };
    await expect(reconcileHeld("shop-1", port, () => ({ action: "commit", actualAmount: 3 }))).resolves.toMatchObject({ committed: 1 });
    expect(calls).toEqual([3]);
  });
});
