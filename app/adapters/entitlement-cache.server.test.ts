import { describe, expect, it } from "vitest";
import { createEntitlementCache } from "./entitlement-cache.server";

function kv(values: Map<string, string>): KVNamespace {
  return {
    get: async (key: string) => values.get(key) ?? null,
    put: async (key: string, value: string) => { values.set(key, value); },
    delete: async (key: string) => { values.delete(key); },
  } as KVNamespace;
}

describe("entitlement cache", () => {
  it("round trips validated snapshots and deletes by shop", async () => {
    const values = new Map<string, string>();
    const cache = createEntitlementCache(kv(values), { now: () => 100_000, ttlSeconds: 60 });
    const snapshot = { status: "ACTIVE" as const, planHandle: "free", revision: 4 };
    await cache.put("a.myshopify.com", { catalogueVersion: 1, snapshot });
    await expect(cache.get("a.myshopify.com")).resolves.toEqual({ catalogueVersion: 1, snapshot });
    await cache.delete("a.myshopify.com");
    await expect(cache.get("a.myshopify.com")).resolves.toBeNull();
  });

  it("rejects malformed and stale entries", async () => {
    const values = new Map<string, string>([["entitlements:v1:shop", "{}"]]);
    const cache = createEntitlementCache(kv(values), { now: () => 100_000, ttlSeconds: 60 });
    await expect(cache.get("shop")).resolves.toBeNull();
    values.set("entitlements:v1:shop", JSON.stringify({ catalogueVersion: 1, snapshot: { status: "ACTIVE", planHandle: "free", revision: 1 }, cachedAt: 0 }));
    await expect(cache.get("shop")).resolves.toBeNull();
  });
});
