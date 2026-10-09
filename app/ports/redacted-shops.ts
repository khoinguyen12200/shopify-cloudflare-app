/** One-way key for a shop domain; the domain itself must never reach the tombstone table. */
export interface ShopHasher {
  hash(shop: string): Promise<string>;
}

/** Redaction tombstones, keyed by `ShopHasher` output. Not shop-scoped: the shop's data is gone by design. */
export interface RedactedShopsPort {
  /** Idempotent: a second mark keeps the original timestamp. */
  mark(shopHash: string, redactedAt: number): Promise<void>;
  isRedacted(shopHash: string): Promise<boolean>;
  /** True when a tombstone was removed. */
  clear(shopHash: string): Promise<boolean>;
  /** One query for any number of hashes; the subset that is tombstoned. */
  findRedacted(shopHashes: readonly string[]): Promise<ReadonlySet<string>>;
}

export interface RedactionTombstone {
  readonly shopHash: string;
  readonly redactedAt: number;
}
