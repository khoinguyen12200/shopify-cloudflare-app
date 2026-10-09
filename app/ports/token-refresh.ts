/**
 * What happened when we tried to exchange a shop's stored refresh token for a new access token.
 *
 * Shopify answers `401 {"error":"invalid_request"}` for EVERY terminal case — unknown, replaced, expired, revoked or
 * uninstalled — so the one conclusion a caller may draw from `terminal` is "this token pair is dead", and the one
 * thing that makes that mean "uninstalled" is that nobody else replaced the pair meanwhile
 * (https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange).
 */
export type TokenRefreshOutcome =
  /** A new pair was exchanged and stored. */
  | { readonly kind: "refreshed" }
  /** The access token is still comfortably valid; nothing was sent. */
  | { readonly kind: "fresh" }
  /** No stored offline session with a refresh token, so there is nothing to probe with. */
  | { readonly kind: "no_session" }
  /** Terminal 401 and the stored pair is the one we presented: the app is no longer installed. */
  | { readonly kind: "terminal" }
  /** Someone else (the library, a merchant visit) replaced the stored pair while we were calling. Not terminal. */
  | { readonly kind: "superseded" }
  /** Network error, timeout, 429 or 5xx. Retry later; says nothing about installation. */
  | { readonly kind: "transient"; readonly detail: string }
  /** Anything else (rejected credentials, malformed body). Never read as an uninstall. */
  | { readonly kind: "unexpected"; readonly detail: string };

export interface ShopTokenRefresher {
  refresh(shop: string, now: number): Promise<TokenRefreshOutcome>;
}
