import { toTimeZone, UTC } from "~/i18n/time-zone";

export interface ShopTimeZonePorts {
  /** What was stored for the shop, or null before the first sync. */
  readonly stored: (shop: string) => Promise<string | null>;
  /** Ask Shopify for the shop's IANA zone; null when it cannot say. */
  readonly fetch: (shop: string) => Promise<string | null>;
  readonly record: (shop: string, timeZone: string) => Promise<void>;
  readonly unavailable: (shop: string) => Promise<void>;
}

/**
 * The zone to render the shop's dates in. Stored once, so Shopify is asked only the first time; when Shopify cannot
 * say, `UTC` keeps every page rendering (and the server and browser still agree) and the lookup is retried on the next
 * load. A merchant sees UTC times for that moment, never a broken page.
 */
export async function resolveShopTimeZone(shop: string, ports: ShopTimeZonePorts): Promise<string> {
  const stored = toTimeZone(await ports.stored(shop));
  if (stored !== null) return stored;
  const fetched = toTimeZone(await ports.fetch(shop));
  if (fetched === null) {
    await ports.unavailable(shop);
    return UTC;
  }
  await ports.record(shop, fetched);
  return fetched;
}
