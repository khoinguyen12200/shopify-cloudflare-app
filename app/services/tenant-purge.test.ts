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
});
