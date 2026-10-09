export interface TenantPurgeD1Port {
  prepare(shop: string): Promise<{ readonly shop: string; readonly attachmentKeys: readonly string[] }>;
  deleteRows(shop: string): Promise<number>;
}
export interface TenantPurgeR2Port { delete(keys: readonly string[]): Promise<void>; }
export interface TenantPurgeKvPort { deleteSessions(shop: string): Promise<number>; }
export interface TenantPurgeEntitlementCachePort { invalidate(shop: string): Promise<void>; }
export interface PurgeResult { readonly rows: number; readonly attachments: number; readonly sessions: number; }

export function chunkR2Keys(keys: readonly string[]): readonly (readonly string[])[] {
  const chunks: string[][] = [];
  for (let index = 0; index < keys.length; index += 1_000) chunks.push([...keys.slice(index, index + 1_000)]);
  return chunks;
}

/**
 * Erase everything held for a shop. Order matters because the purge runs from a queued `shop/redact` delivery, and
 * the D1 batch deletes that delivery's own row along with the shop's:
 *
 *   1. R2 objects, 2. KV sessions — idempotent, and neither destroys the evidence that work is owed. A failure here leaves the delivery row in place, so the queue retries the whole purge.
 *   3. D1 rows. This is the commit point: once the batch lands the delivery row is gone, a retry finds nothing
 *      ("missing" in the consumer) and is a safe no-op — which is only correct because nothing is left to undo.
 *
 *   4. The entitlement cache, last: it is advisory and its invalidation never throws, so it cannot strand the purge.
 *
 * Purging KV after D1 would invert that: a KV failure would leave sessions (online sessions carry staff names and
 * emails) with no delivery row left to drive the retry.
 */
export async function purgeTenant(deps: {
  readonly d1: TenantPurgeD1Port;
  readonly r2: TenantPurgeR2Port;
  readonly kv: TenantPurgeKvPort;
  readonly entitlementCache?: TenantPurgeEntitlementCachePort;
}, shop: string): Promise<PurgeResult> {
  const prepared = await deps.d1.prepare(shop);
  for (const keys of chunkR2Keys(prepared.attachmentKeys)) await deps.r2.delete(keys);
  const sessions = await deps.kv.deleteSessions(shop);
  const rows = await deps.d1.deleteRows(shop);
  if (deps.entitlementCache) await deps.entitlementCache.invalidate(shop);
  return { rows, attachments: prepared.attachmentKeys.length, sessions };
}
