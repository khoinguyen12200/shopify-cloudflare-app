import { createEntitlementCache, type EntitlementCacheAdapterPort } from "~/adapters/entitlement-cache.server";
import { ENTITLEMENT_CATALOGUE } from "~/billing/entitlement-catalogue";
import type { EntitlementCachePort } from "~/ports/entitlements";
import { getEnv } from "~/request-context.server";

/** Advisory KV cache for entitlement previews; D1 remains authoritative. */
export function entitlementCache(): EntitlementCacheAdapterPort {
  return createEntitlementCache(getEnv().SESSION, { catalogueVersion: ENTITLEMENT_CATALOGUE.version });
}

export function entitlementCachePort(): EntitlementCachePort {
  const cache = entitlementCache();
  return {
    get: async (shop) => (await cache.get(shop))?.snapshot ?? null,
    set: async (shop, snapshot, _ttlSeconds) => cache.put(shop, { catalogueVersion: ENTITLEMENT_CATALOGUE.version, snapshot }),
    invalidate: (shop) => cache.delete(shop),
  };
}

export async function invalidateEntitlements(shop: string): Promise<void> {
  try {
    await entitlementCache().delete(shop);
  } catch (error) {
    console.error(JSON.stringify({
      event: "entitlements.cache_invalidation_failed",
      shop,
      error: error instanceof Error ? error.message : "unknown",
    }));
  }
}
