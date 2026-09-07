import { describe, expect, it } from "vitest";
import { createEntitlementCache } from "./entitlement-cache.server";

function memoryKv(values = new Map<string, string>(), failures: Partial<Record<"get" | "put" | "delete", boolean>> = {}) {
  const puts: Array<{ key: string; ttl: number | undefined }> = [];
  return {
    values, puts,
    binding: {
      async get(key: string) { if (failures.get) throw new Error("get failed"); return values.get(key) ?? null; },
      async put(key: string, value: string, options?: KVNamespacePutOptions) { if (failures.put) throw new Error("put failed"); values.set(key, value); puts.push({ key, ttl: options?.expirationTtl }); },
      async delete(key: string) { if (failures.delete) throw new Error("delete failed"); values.delete(key); },
    },
  };
}

const snapshot = { status: "ACTIVE" as const, planHandle: "free", revision: 4, periodStart: 10, periodEnd: 20 };

describe("entitlement cache", () => {
  it("round trips a valid snapshot with bounded TTL and isolates shops", async () => {
    const kv = memoryKv(); const cache = createEntitlementCache(kv.binding, { now: () => 100_000, ttlSeconds: 60 });
    await cache.put("a", { catalogueVersion: 1, snapshot });
    await expect(cache.get("a")).resolves.toEqual({ catalogueVersion: 1, snapshot });
    await expect(cache.get("b")).resolves.toBeNull();
    expect(kv.puts).toEqual([{ key: "entitlements:v1:a", ttl: 60 }]);
  });

  it.each([
    ["malformed JSON", "{"], ["non-object", "null"], ["wrong schema version", JSON.stringify({ catalogueVersion: 2, snapshot, cachedAt: 100_000 })],
    ["unknown status", JSON.stringify({ catalogueVersion: 1, snapshot: { ...snapshot, status: "BROKEN" }, cachedAt: 100_000 })],
    ["invalid plan", JSON.stringify({ catalogueVersion: 1, snapshot: { ...snapshot, planHandle: 2 }, cachedAt: 100_000 })],
    ["negative revision", JSON.stringify({ catalogueVersion: 1, snapshot: { ...snapshot, revision: -1 }, cachedAt: 100_000 })],
    ["fractional revision", JSON.stringify({ catalogueVersion: 1, snapshot: { ...snapshot, revision: 1.5 }, cachedAt: 100_000 })],
    ["invalid timestamp", JSON.stringify({ catalogueVersion: 1, snapshot: { ...snapshot, periodStart: "10" }, cachedAt: 100_000 })],
    ["reversed period", JSON.stringify({ catalogueVersion: 1, snapshot: { ...snapshot, periodStart: 30, periodEnd: 20 }, cachedAt: 100_000 })],
    ["stale", JSON.stringify({ catalogueVersion: 1, snapshot, cachedAt: 39_999 })],
    ["future", JSON.stringify({ catalogueVersion: 1, snapshot, cachedAt: 100_001 })],
    ["non-finite cached time", JSON.stringify({ catalogueVersion: 1, snapshot, cachedAt: Number.NaN })],
  ])("rejects %s cache entries", async (_name, raw) => {
    const kv = memoryKv(new Map([["entitlements:v1:a", raw]]));
    await expect(createEntitlementCache(kv.binding, { now: () => 100_000, ttlSeconds: 60 }).get("a")).resolves.toBeNull();
  });

  it("treats get failure as a miss and propagates failed writes and invalidation", async () => {
    await expect(createEntitlementCache(memoryKv(undefined, { get: true }).binding).get("a")).resolves.toBeNull();
    await expect(createEntitlementCache(memoryKv(undefined, { put: true }).binding).put("a", { catalogueVersion: 1, snapshot })).rejects.toThrow("put failed");
    await expect(createEntitlementCache(memoryKv(undefined, { delete: true }).binding).delete("a")).rejects.toThrow("delete failed");
  });

  it("invalidates only the requested shop", async () => {
    const kv = memoryKv(new Map([["entitlements:v1:a", "a"], ["entitlements:v1:b", "b"]])); const cache = createEntitlementCache(kv.binding);
    await cache.delete("a"); expect(kv.values.has("entitlements:v1:a")).toBe(false); expect(kv.values.has("entitlements:v1:b")).toBe(true);
  });
});
