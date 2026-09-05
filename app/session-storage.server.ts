import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";

/** The shape `Session.toPropertyArray()` produces / `fromPropertyArray` reads. */
type SessionProps = ReturnType<Session["toPropertyArray"]>;

/** KV caps metadata at 1024 bytes per entry; larger payloads fall back to a get. */
const METADATA_MAX_BYTES = 1024;

/**
 * Seconds until `expires`, clamped to KV's 60s minimum — or `undefined` when
 * there is no expiry to honour.
 */
export function ttlSeconds(
  expires: Date | undefined,
  now: number,
): number | undefined {
  if (!expires) return undefined;
  return Math.max(60, Math.floor((expires.getTime() - now) / 1000));
}

/** True when the JSON payload fits inside KV's per-entry metadata cap. */
function fitsAsMetadata(payload: string): boolean {
  return new TextEncoder().encode(payload).length <= METADATA_MAX_BYTES;
}

/**
 * Cloudflare KV-backed Shopify session storage.
 *
 * Shopify ships no official Cloudflare adapter, so we implement the small
 * `SessionStorage` interface directly against a KV namespace.
 *
 * Key layout:
 *   session:{id}          -> the session property array as JSON
 *   shopidx:{shop}:{id}   -> "" with the property array in KV metadata, so
 *                            findSessionsByShop reads sessions straight off the
 *                            list page with no per-id get. Sessions too large
 *                            for the metadata cap fall back to a load by id.
 */
export class KVSessionStorage implements SessionStorage {
  constructor(private readonly kv: KVNamespace) {}

  private sessionKey(id: string) {
    return `session:${id}`;
  }

  private shopIndexKey(shop: string, id: string) {
    return `shopidx:${shop}:${id}`;
  }

  /**
   * An offline session's record must OUTLIVE its access token.
   *
   * With `future.expiringOfflineAccessTokens` (mandatory for public apps),
   * offline access tokens expire after 60 minutes and arrive with a refresh
   * token the library uses to renew them, no merchant involved. Deriving a KV
   * expiration from `session.expires` would therefore delete the whole record —
   * and the refresh token with it — an hour after every install, leaving
   * `unauthenticated.admin(shop)` (cron sweeps, queue consumers, app-proxy
   * requests) with no session to work from.
   *
   * So expiry drives eviction for ONLINE sessions only: those are per-user and
   * are recreated on the merchant's next admin visit, so letting them lapse
   * costs nothing.
   */
  async storeSession(session: Session): Promise<boolean> {
    const props = session.toPropertyArray();
    const payload = JSON.stringify(props);
    const ttl = session.isOnline
      ? ttlSeconds(session.expires, Date.now())
      : undefined;
    const expiry = ttl ? { expirationTtl: ttl } : {};
    const metadata = fitsAsMetadata(payload) ? props : undefined;

    await this.kv.put(this.sessionKey(session.id), payload, expiry);
    await this.kv.put(this.shopIndexKey(session.shop, session.id), "", {
      ...expiry,
      ...(metadata ? { metadata } : {}),
    });
    return true;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const raw = await this.kv.get(this.sessionKey(id));
    if (!raw) return undefined;
    return Session.fromPropertyArray(JSON.parse(raw));
  }

  async deleteSession(id: string): Promise<boolean> {
    // Load first so the shop-index entry can be cleaned up too.
    const existing = await this.loadSession(id);
    await this.kv.delete(this.sessionKey(id));
    if (existing) {
      await this.kv.delete(this.shopIndexKey(existing.shop, id));
    }
    return true;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    await Promise.all(ids.map((id) => this.deleteSession(id)));
    return true;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const prefix = `shopidx:${shop}:`;
    const sessions: Session[] = [];
    const indexed: Array<{ id: string; metadata?: SessionProps }> = [];
    let cursor: string | undefined;
    do {
      const list = await this.kv.list<SessionProps>({ prefix, cursor });
      for (const key of list.keys) {
        indexed.push({ id: key.name.slice(prefix.length), metadata: key.metadata });
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    const loaded = await Promise.all(indexed.map(({ id }) => this.loadSession(id)));
    for (let index = 0; index < loaded.length; index += 1) {
      const session = loaded[index];
      if (session) {
        sessions.push(session);
      } else {
        await this.kv.delete(this.shopIndexKey(shop, indexed[index].id));
      }
    }
    return sessions;
  }
}
