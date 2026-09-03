export interface TenantPurgeD1Port {
  prepare(shop: string): Promise<{ readonly shop: string; readonly attachmentKeys: readonly string[] }>;
  deleteRows(shop: string): Promise<number>;
}
export interface TenantPurgeR2Port { delete(keys: readonly string[]): Promise<void>; }
export interface TenantPurgeKvPort { deleteSessions(shop: string): Promise<number>; }
export interface PurgeResult { readonly rows: number; readonly attachments: number; readonly sessions: number; }

export function chunkR2Keys(keys: readonly string[]): readonly (readonly string[])[] {
  const chunks: string[][] = [];
  for (let index = 0; index < keys.length; index += 1_000) chunks.push([...keys.slice(index, index + 1_000)]);
  return chunks;
}

export async function purgeTenant(deps: {
  readonly d1: TenantPurgeD1Port;
  readonly r2: TenantPurgeR2Port;
  readonly kv: TenantPurgeKvPort;
}, shop: string): Promise<PurgeResult> {
  const prepared = await deps.d1.prepare(shop);
  for (const keys of chunkR2Keys(prepared.attachmentKeys)) await deps.r2.delete(keys);
  const rows = await deps.d1.deleteRows(shop);
  const sessions = await deps.kv.deleteSessions(shop);
  return { rows, attachments: prepared.attachmentKeys.length, sessions };
}
