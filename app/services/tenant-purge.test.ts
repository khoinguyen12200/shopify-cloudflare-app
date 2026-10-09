import { describe, expect, it } from "vitest";
import { chunkR2Keys, purgeTenant } from "./tenant-purge.server";

describe("purgeTenant", () => {
  it("chunks R2 deletion keys at one thousand objects", () => {
    const keys = Array.from({ length: 2_001 }, (_, index) => `key-${index}`);
    expect(chunkR2Keys(keys)).toEqual([
      keys.slice(0, 1_000), keys.slice(1_000, 2_000), keys.slice(2_000),
    ]);
  });

  it("deletes R2 objects and KV sessions BEFORE the relational rows, which are the commit point", async () => {
    const order: string[] = [];
    const result = await purgeTenant({
      d1: { prepare: async () => ({ shop: "s", attachmentKeys: ["a", "b"] }), deleteRows: async () => { order.push("d1"); return 3; } },
      r2: { delete: async (keys) => { order.push(`r2:${keys.length}`); } },
      kv: { deleteSessions: async () => { order.push("kv"); return 2; } },
    }, "s");
    expect(order).toEqual(["r2:2", "kv", "d1"]);
    expect(result).toEqual({ rows: 3, attachments: 2, sessions: 2 });
  });

  it("keeps other tenant data intact at each purge boundary", async () => {
    const state = { r2: new Set(["alpha/file", "beta/file"]), rows: new Set(["alpha", "beta"]), kv: new Set(["alpha", "beta"]) };
    const seen: string[] = [];
    const result = await purgeTenant({
      d1: {
        prepare: async () => ({ shop: "alpha", attachmentKeys: ["alpha/file"] }),
        deleteRows: async (shop) => { seen.push(`d1:${state.r2.has("beta/file")}`); state.rows.delete(shop); return 1; },
      },
      r2: { delete: async (keys) => { for (const key of keys) state.r2.delete(key); seen.push(`r2:${state.r2.has("beta/file")}`); } },
      kv: { deleteSessions: async (shop) => { state.kv.delete(shop); seen.push(`kv:${state.kv.has("beta")}`); return 1; } },
    }, "alpha");
    expect(seen).toEqual(["r2:true", "kv:true", "d1:true"]);
    expect([...state.r2]).toEqual(["beta/file"]);
    expect([...state.rows]).toEqual(["beta"]);
    expect([...state.kv]).toEqual(["beta"]);
    expect(result).toEqual({ rows: 1, attachments: 1, sessions: 1 });
  });

  it("keeps the delivery row (and so the retry) alive when KV deletion fails: D1 is only touched after R2 and KV succeed", async () => {
    const order: string[] = [];
    await expect(purgeTenant({
      d1: { prepare: async () => ({ shop: "s", attachmentKeys: [] }), deleteRows: async () => { order.push("d1"); return 1; } },
      r2: { delete: async () => undefined },
      kv: { deleteSessions: async () => { throw new Error("kv down"); } },
    }, "s")).rejects.toThrow("kv down");
    expect(order).toEqual([]);
  });

  it("invalidates entitlement cache after tenant purge", async () => {
    let invalidated = "";
    await purgeTenant({ d1: { prepare: async () => ({ shop: "s", attachmentKeys: [] }), deleteRows: async () => 0 }, r2: { delete: async () => undefined }, kv: { deleteSessions: async () => 0 }, entitlementCache: { invalidate: async (shop) => { invalidated = shop; } } }, "s");
    expect(invalidated).toBe("s");
  });
});
