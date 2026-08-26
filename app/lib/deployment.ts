/**
 * Is this a real deployment?
 *
 * Derived from the app URL scheme, NOT from `process.env.NODE_ENV` — workerd does
 * not populate that, so a NODE_ENV check silently reports "development" in
 * production, which is the worst possible direction for a gate that unlocks
 * development conveniences.
 *
 * PURE: the URL is a parameter, never read from `getEnv()` here. Ring 1 imports
 * nothing with I/O (@rules/architecture.md), and reading the environment inside
 * made this untestable — calling it outside a request context simply threw. The
 * caller is in ring 5, which is where `getEnv()` belongs.
 */
export function isProductionLike(appUrl: string): boolean {
  return appUrl.startsWith("https://");
}
