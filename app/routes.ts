import {
  type RouteConfig,
  route,
  index,
  layout,
  prefix,
} from "@react-router/dev/routes";

/**
 * Explicit route config, NOT flat file-name routing.
 *
 * The URL structure lives here, and the file tree mirrors it — `/legal/privacy`
 * is `routes/public/legal/privacy.tsx`, not `routes/legal.privacy.tsx`. With
 * dozens of routes, a flat directory of dot-separated names stops being
 * readable, and you cannot tell a layout from a leaf. See @rules/architecture.md.
 *
 * One surface per top-level group. Add a route to the group it belongs to; if it
 * fits none of them, that is a sign it is a new surface, so add a new group and
 * its own folder.
 */
export default [
  // ── Public surface ────────────────────────────────────────────────────────
  // Marketing, legal, and support. No authentication: the App Store listing
  // links straight to /legal/privacy and a reviewer must reach it uninstalled.
  // The layout owns the SCSS, header, and footer.
  layout("routes/public/_layout.tsx", [
    index("routes/public/landing.tsx"),
    route("pricing", "routes/public/pricing.tsx"),
    route("support", "routes/public/support.tsx"),
    ...prefix("legal", [
      route("privacy", "routes/public/legal/privacy.tsx"),
      route("terms", "routes/public/legal/terms.tsx"),
    ]),
  ]),

  // ── Embedded Shopify admin ────────────────────────────────────────────────
  // Everything under /app runs inside the Shopify admin iframe. The layout
  // authenticates and provides App Bridge + Polaris web components.
  route("app", "routes/app/_layout.tsx", [
    index("routes/app/home.tsx"),
  ]),

  // ── OAuth ─────────────────────────────────────────────────────────────────
  // Paths are fixed by `authPathPrefix: "/auth"` in app/shopify.server.ts and by
  // the redirect_urls in shopify.app*.toml — do not rename them.
  ...prefix("auth", [
    route("login", "routes/auth/login.tsx"),
    // Splat: /auth, /auth/callback and the rest are handled by the library.
    route("*", "routes/auth/callback.tsx"),
  ]),

  // ── Internal staff console ────────────────────────────────────────────────
  // Not merchant-facing: this is the team's console for operating the app.
  // Login and logout sit OUTSIDE the layout — the layout's loader requires a
  // signed-in user, so a login page inside it would redirect to itself.
  route("internal/login", "routes/internal/login.tsx"),
  route("internal/logout", "routes/internal/logout.tsx"),
  layout("routes/internal/_layout.tsx", [
    // /internal redirects to the dashboard.
    route("internal", "routes/internal/index.tsx"),
    route("internal/dashboard", "routes/internal/dashboard.tsx"),
    route("internal/admins", "routes/internal/admins.tsx"),
    route("internal/profile", "routes/internal/profile.tsx"),
  ]),

  // ── Resource routes ────────────────────────────────────────────────────────
  // Action-only endpoints with no UI of their own.
  route("locale", "routes/resources/locale.tsx"),

  // ── Webhooks ──────────────────────────────────────────────────────────────
  // URIs must match the subscriptions in BOTH shopify.app.toml files.
  ...prefix("webhooks", [
    route("app/uninstalled", "routes/webhooks/app/uninstalled.tsx"),
    route("app/scopes_update", "routes/webhooks/app/scopes-update.tsx"),
    // All three mandatory compliance topics share this endpoint.
    route("compliance", "routes/webhooks/compliance.tsx"),
  ]),
] satisfies RouteConfig;
