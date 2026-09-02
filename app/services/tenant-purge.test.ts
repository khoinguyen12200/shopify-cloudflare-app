import { describe, expect, it } from "vitest";
import { purgeTenant } from "./tenant-purge.server";

describe("purgeTenant", () => {
  it("deletes R2 objects before relational rows and then KV sessions", async () => {
    const order: string[] = [];
    const result = await purgeTenant({
      d1: { prepare: async () => ({ shop: "s", attachmentKeys: ["a", "b"] }), deleteRows: async () => { order.push("d1"); return 3; } },
      r2: { delete: async (keys) => { order.push(`r2:${keys.length}`); } },
      kv: { deleteSessions: async () => { order.push("kv"); return 2; } },
    }, "s");
    expect(order).toEqual(["r2:2", "d1", "kv"]);
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
    expect(seen).toEqual(["r2:true", "d1:true", "kv:true"]);
    expect([...state.r2]).toEqual(["beta/file"]);
    expect([...state.rows]).toEqual(["beta"]);
    expect([...state.kv]).toEqual(["beta"]);
    expect(result).toEqual({ rows: 1, attachments: 1, sessions: 1 });
  });
});
