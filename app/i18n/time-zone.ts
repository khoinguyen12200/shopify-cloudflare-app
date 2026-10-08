/**
 * The zone every date is rendered in.
 *
 * A server (UTC on Workers) and a browser (the visitor's own zone) format the same instant differently, so a date
 * rendered with no zone makes the server HTML and the first client render disagree and React discards the server
 * markup (hydration error #418). Naming the zone explicitly makes both sides print identical text. The merchant
 * admin and the customer pages use the shop's own zone; fixed-calendar content (legal pages) and the English-only
 * staff console use `UTC`.
 */
export const UTC = "UTC";

/**
 * A usable IANA zone name, or `null`. The platform decides: `Intl.DateTimeFormat` accepts every IANA name and alias
 * (including ones `Intl.supportedValuesOf` omits because it lists canonical names only, such as `Asia/Saigon` for
 * `Asia/Ho_Chi_Minh`) and throws `RangeError` for anything else. A stored typo must not break every page that shows
 * a date, so an unusable name is reported as `null` and the caller falls back.
 */
export function toTimeZone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const zone = value.trim();
  if (zone === "") return null;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return zone;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}
