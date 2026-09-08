import type { SubscriptionSnapshot } from "~/domain/entitlement-policy";

export interface EntitlementCacheValue { readonly catalogueVersion: number; readonly snapshot: SubscriptionSnapshot; }
export interface EntitlementCacheAdapterPort { get(shop: string): Promise<EntitlementCacheValue | null>; put(shop: string, value: EntitlementCacheValue): Promise<void>; delete(shop: string): Promise<void>; }
interface EntitlementKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}
const PREFIX = "entitlements:v1:";
const DEFAULT_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;
const STATUSES = new Set(["NONE", "PENDING", "ACTIVE", "CANCELLATION_SCHEDULED", "FROZEN", "CANCELED", "UNKNOWN"]);
function nonNegativeSafe(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0; }
function valid(value: unknown, now: number, ttl: number, catalogueVersion: number): value is EntitlementCacheValue & { cachedAt: number } {
  if (!value || typeof value !== "object") return false;
  const record: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  const snapshot = record.snapshot;
  if (record.catalogueVersion !== catalogueVersion || !Number.isSafeInteger(record.catalogueVersion) || !nonNegativeSafe(record.cachedAt) || record.cachedAt > now || now - record.cachedAt > ttl * 1000 || !snapshot || typeof snapshot !== "object") return false;
  const s: Record<string, unknown> = Object.fromEntries(Object.entries(snapshot));
  const timestamps = [s.cancellationEffectiveAt, s.periodStart, s.periodEnd].filter((v) => v !== undefined);
  return typeof s.status === "string" && STATUSES.has(s.status) && (typeof s.planHandle === "string" || s.planHandle === null) && nonNegativeSafe(s.revision) && timestamps.every(nonNegativeSafe) && (s.periodStart === undefined || s.periodEnd === undefined || (nonNegativeSafe(s.periodStart) && nonNegativeSafe(s.periodEnd) && s.periodStart < s.periodEnd));
}
export function createEntitlementCache(kv: EntitlementKv, options: { now?: () => number; ttlSeconds?: number; catalogueVersion?: number } = {}): EntitlementCacheAdapterPort {
  const now = options.now ?? Date.now;
  const requestedTtl = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const ttl = Number.isSafeInteger(requestedTtl) ? Math.min(MAX_TTL_SECONDS, Math.max(60, requestedTtl)) : DEFAULT_TTL_SECONDS;
  return {
    async get(shop) { try { const raw = await kv.get(`${PREFIX}${shop}`); if (!raw) return null; const parsed: unknown = JSON.parse(raw); return valid(parsed, now(), ttl, options.catalogueVersion ?? 1) ? { catalogueVersion: parsed.catalogueVersion, snapshot: parsed.snapshot } : null; } catch { return null; } },
    async put(shop, value) { await kv.put(`${PREFIX}${shop}`, JSON.stringify({ ...value, cachedAt: now() }), { expirationTtl: ttl }); },
    async delete(shop) { await kv.delete(`${PREFIX}${shop}`); },
  };
}
