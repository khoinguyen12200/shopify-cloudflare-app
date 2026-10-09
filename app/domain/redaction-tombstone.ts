/**
 * The redaction tombstone decision. Pure: the caller says whether a tombstone exists and where the observation came
 * from; this says what to do. Shopify's docs do not define reinstall or tombstone behaviour, so this policy is ours.
 *
 * - Anything that did not come from the merchant (Partner history, a webhook delivery, a scheduled sweep) must not
 *   create or revive a shop that was erased: `suppress`.
 * - The merchant installing the app again is the one signal that the shop is wanted back: `clear` the tombstone.
 */
export type ObservationSource = "partner_event" | "webhook_delivery" | "scheduled_sweep" | "merchant_install";

export type TombstoneDecision = "proceed" | "suppress" | "clear";

export function decideTombstone(tombstoned: boolean, source: ObservationSource): TombstoneDecision {
  switch (source) {
    case "merchant_install":
      return tombstoned ? "clear" : "proceed";
    case "partner_event":
    case "webhook_delivery":
    case "scheduled_sweep":
      return tombstoned ? "suppress" : "proceed";
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

/** Shop domains are case-insensitive; the tombstone key must not depend on how a caller spelled one. */
export function normalizeShopDomain(shop: string): string {
  return shop.trim().toLowerCase();
}
