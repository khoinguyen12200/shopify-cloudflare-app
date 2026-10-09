import { decideTombstone, type ObservationSource } from "~/domain/redaction-tombstone";
import type { RedactedShopsPort, ShopHasher } from "~/ports/redacted-shops";

export interface RedactionGuard {
  /** True when an observation from `source` about `shop` must be ignored because the shop was redacted. */
  isSuppressed(shop: string, source: ObservationSource): Promise<boolean>;
  /** The subset of `shops` that is redacted, found with ONE tombstone query. */
  redactedAmong(shops: readonly string[]): Promise<ReadonlySet<string>>;
  /** The merchant installed again: drop the tombstone. True when one existed. */
  clearOnInstall(shop: string): Promise<boolean>;
}

export interface RedactionGuardPorts {
  readonly hasher: ShopHasher;
  readonly tombstones: RedactedShopsPort;
}

export function createRedactionGuard(ports: RedactionGuardPorts): RedactionGuard {
  return {
    async isSuppressed(shop, source) {
      const tombstoned = await ports.tombstones.isRedacted(await ports.hasher.hash(shop));
      return decideTombstone(tombstoned, source) === "suppress";
    },
    async redactedAmong(shops) {
      const hashed = await Promise.all(shops.map(async (shop) => ({ shop, hash: await ports.hasher.hash(shop) })));
      const found = await ports.tombstones.findRedacted(hashed.map(({ hash }) => hash));
      return new Set(hashed.filter(({ hash }) => found.has(hash)).map(({ shop }) => shop));
    },
    async clearOnInstall(shop) {
      const hash = await ports.hasher.hash(shop);
      const tombstoned = await ports.tombstones.isRedacted(hash);
      if (decideTombstone(tombstoned, "merchant_install") !== "clear") return false;
      return ports.tombstones.clear(hash);
    },
  };
}
