// ─────────────────────────────────────────────────────────────────────────────
// THE ONLY PLACE APP URLS ARE BUILT.
//
// A link is used from more places than it looks: a route, a redirect, a nav item,
// an email body, a test. Each one that builds its own string is a copy that can
// drift — and a link inside an EMAIL cannot be fixed after it is sent, so a drift
// there is permanent for everyone who already received it.
//
// Pure and client-safe: string building only, no env, no request. Absolute URLs
// take the origin as an argument rather than reading it from configuration,
// because the correct origin is the one the request arrived on (a tunnel in dev,
// the custom domain in production) and nothing here can know that.
// ─────────────────────────────────────────────────────────────────────────────

/** Paths within the app. Relative — for `<Link to>`, redirects, and loaders. */
export const paths = {
  /** Public marketing and legal surface. */
  home: () => "/",
  pricing: () => "/pricing",
  support: () => "/support",
  privacy: () => "/legal/privacy",
  terms: () => "/legal/terms",

  /** Embedded Shopify admin. */
  app: () => "/app",

  /** OAuth. Fixed by `authPathPrefix` and the TOML redirect_urls. */
  login: () => "/auth/login",

  /** Internal staff console. */
  internal: {
    login: () => "/internal/login",
    logout: () => "/internal/logout",
    dashboard: () => "/internal/dashboard",
    admins: () => "/internal/admins",
    /** An owner resetting another admin's password. */
    resetAdminPassword: (adminId: string) =>
      `/internal/admins/${encodeURIComponent(adminId)}/reset`,
    profile: () => "/internal/profile",
    forgotPassword: () => "/internal/forgot-password",
    /**
     * The self-service reset link.
     *
     * The token is a credential in the path, so it is encoded — a raw token
     * containing a reserved character would silently produce a URL that does not
     * match, and the recipient would see "invalid link" for a valid token.
     */
    resetPassword: (token: string) =>
      `/internal/reset-password/${encodeURIComponent(token)}`,
  },

  /** Webhooks. Must match the URIs in BOTH shopify.app*.toml files. */
  webhooks: {
    appUninstalled: () => "/webhooks/app/uninstalled",
    appScopesUpdate: () => "/webhooks/app/scopes_update",
    compliance: () => "/webhooks/compliance",
  },
} as const;

/**
 * An absolute URL, for somewhere the app itself is not — an email body, an
 * external redirect, a webhook registration.
 *
 * `origin` comes from the incoming request (`new URL(request.url).origin`), so a
 * link always points back at the deployment the recipient is actually using.
 * Hardcoding it, or reading it from config, is how a dev tunnel link ends up in a
 * production email.
 */
export function absolute(origin: string, path: string): string {
  // Tolerate a trailing slash on the origin so callers need not normalise it.
  return `${origin.replace(/\/+$/, "")}${path}`;
}
