import { createRedactionGuard } from "~/services/redaction-guard";
import type { RedactedShopsPort, ShopHasher } from "~/ports/redacted-shops";

/** A guard that suppresses nothing, for tests whose subject is not redaction. */
export const noRedaction = {
  isSuppressed: async () => false,
  redactedAmong: async (): Promise<ReadonlySet<string>> => new Set<string>(),
  clearOnInstall: async () => false,
};

/** Identity hasher, so a fake tombstone store can be keyed by the domain a test names. Never used outside tests. */
export const identityHasher: ShopHasher = { hash: async (shop) => shop.toLowerCase() };

/** An in-memory tombstone store behind the real guard, for service-level tests with no D1. */
export function fakeRedaction(initial: readonly string[] = []) {
  const hashes = new Map<string, number>(initial.map((shop) => [shop.toLowerCase(), 1]));
  const tombstones: RedactedShopsPort = {
    mark: async (hash, at) => { if (!hashes.has(hash)) hashes.set(hash, at); },
    isRedacted: async (hash) => hashes.has(hash),
    clear: async (hash) => hashes.delete(hash),
    findRedacted: async (wanted) => new Set(wanted.filter((hash) => hashes.has(hash))),
  };
  return { guard: createRedactionGuard({ hasher: identityHasher, tombstones }), hashes };
}
