import { getEnv } from "~/request-context.server";

/**
 * Is this a real deployment?
 *
 * Derived from the app URL scheme, NOT from `process.env.NODE_ENV` — workerd does
 * not populate that, so a NODE_ENV check silently reports "development" in
 * production, which is the worst possible direction for a gate that unlocks
 * development conveniences.
 */
export function isProductionLike(): boolean {
  return (getEnv().SHOPIFY_APP_URL ?? "").startsWith("https://");
}
