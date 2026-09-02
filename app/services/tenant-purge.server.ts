export interface TenantPurgeD1Port {
  prepare(shop: string): Promise<{ readonly shop: string; readonly attachmentKeys: readonly string[] }>;
  deleteRows(shop: string): Promise<number>;
}
export interface TenantPurgeR2Port { delete(keys: readonly string[]): Promise<void>; }
export interface TenantPurgeKvPort { deleteSessions(shop: string): Promise<number>; }
export interface PurgeResult { readonly rows: number; readonly attachments: number; readonly sessions: number; }

export async function purgeTenant(deps: {
  readonly d1: TenantPurgeD1Port;
  readonly r2: TenantPurgeR2Port;
  readonly kv: TenantPurgeKvPort;
}, shop: string): Promise<PurgeResult> {
  const prepared = await deps.d1.prepare(shop);
  await deps.r2.delete(prepared.attachmentKeys);
  const rows = await deps.d1.deleteRows(shop);
  const sessions = await deps.kv.deleteSessions(shop);
  return { rows, attachments: prepared.attachmentKeys.length, sessions };
}
