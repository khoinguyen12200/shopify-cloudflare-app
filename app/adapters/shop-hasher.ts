import { normalizeShopDomain } from "~/domain/redaction-tombstone";
import { hashShop } from "~/observability/shop-log";
import type { ShopHasher } from "~/ports/redacted-shops";

/**
 * Plain SHA-256 of the lower-cased domain, deliberately the same function the logs use (`hashShop`), so an operator
 * can match a `shopHash` in a log line to a tombstone. A keyed hash (HMAC) would resist a dictionary of
 * `*.myshopify.com` names, but the key would have to live forever: rotating it would silently un-tombstone every
 * redacted shop, which is the failure this table exists to prevent. The row holds no other identifier, so the
 * residual exposure is "someone who already guesses a domain can learn it was redacted".
 */
export const shopHasher: ShopHasher = {
  hash: (shop) => hashShop(normalizeShopDomain(shop)),
};
