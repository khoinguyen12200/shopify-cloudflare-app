import type { SubscriptionSnapshot } from "~/domain/entitlement-policy";

export interface EntitlementCacheValue { readonly catalogueVersion: number; readonly snapshot: SubscriptionSnapshot; }
export interface EntitlementCachePort { get(shop: string): Promise<EntitlementCacheValue | null>; put(shop: string, value: EntitlementCacheValue): Promise<void>; delete(shop: string): Promise<void>; }
const PREFIX = "entitlements:v1:";
function valid(value: unknown, now: number, ttl: number): value is EntitlementCacheValue & { cachedAt: number } {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const snapshot = record.snapshot;
  if (!Number.isSafeInteger(record.catalogueVersion) || typeof record.cachedAt !== "number" || now - record.cachedAt > ttl * 1000 || !snapshot || typeof snapshot !== "object") return false;
  const s = snapshot as Record<string, unknown>;
  return typeof s.status === "string" && (typeof s.planHandle === "string" || s.planHandle === null) && Number.isSafeInteger(s.revision);
}
export function createEntitlementCache(kv: Pick<KVNamespace, "get" | "put" | "delete">, options: { now?: () => number; ttlSeconds?: number } = {}): EntitlementCachePort {
  const now = options.now ?? Date.now; const ttl = options.ttlSeconds ?? 60;
  return {
    async get(shop) { try { const raw = await kv.get(`${PREFIX}${shop}`); if (!raw) return null; const parsed: unknown = JSON.parse(raw); return valid(parsed, now(), ttl) ? { catalogueVersion: parsed.catalogueVersion, snapshot: parsed.snapshot } : null; } catch { return null; } },
    async put(shop, value) { await kv.put(`${PREFIX}${shop}`, JSON.stringify({ ...value, cachedAt: now() }), { expirationTtl: ttl }); },
    async delete(shop) { await kv.delete(`${PREFIX}${shop}`); },
  };
}
