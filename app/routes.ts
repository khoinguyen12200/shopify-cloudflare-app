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
    route("billing", "routes/app/billing.tsx"),
    route("support", "routes/app/support/index.tsx"),
    route("support/new", "routes/app/support/new.tsx"),
    route("support/:ticketId", "routes/app/support/detail.tsx"),
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
  // Self-service recovery, also outside the layout: nobody is signed in yet.
  route("internal/forgot-password", "routes/internal/forgot-password.tsx"),
  // The token is IN THE PATH, so this page must never be indexed — it sets
  // robots noindex. It is also why the token is single-use and short-lived.
  route("internal/reset-password/:token", "routes/internal/reset-password.tsx"),
  layout("routes/internal/_layout.tsx", [
    // /internal redirects to the dashboard.
    route("internal", "routes/internal/index.tsx"),
    route("internal/dashboard", "routes/internal/dashboard.tsx"),
    route("internal/admins", "routes/internal/admins/index.tsx"),
    // Resetting someone else's password is its own page, not a dialog: the field
    // must exist without JavaScript.
    route("internal/admins/:adminId/reset", "routes/internal/admins/reset.tsx"),
    route("internal/subscriptions", "routes/internal/subscriptions.tsx"),
    route("internal/ai", "routes/internal/ai.tsx"),
    route("internal/support", "routes/internal/support/index.tsx"),
    route("internal/support/new", "routes/internal/support/new.tsx"),
    route("internal/support/:ticketId", "routes/internal/support/detail.tsx"),
    route("internal/shops", "routes/internal/shops/index.tsx"),
    route("internal/shops/:shop", "routes/internal/shops/detail.tsx"),
    route("internal/mcp", "routes/internal/mcp.tsx"),
    route("internal/profile", "routes/internal/profile.tsx"),
  ]),

  // ── MCP & Automation Surface ──────────────────────────────────────────────
  // RFC 9728 & RFC 8414 discovery
  route(".well-known/oauth-protected-resource", "routes/.well-known/oauth-protected-resource.ts"),
  route(".well-known/oauth-authorization-server", "routes/.well-known/oauth-authorization-server.ts"),

  // Streamable HTTP JSON-RPC MCP Server
  route("api/mcp", "routes/api/mcp.ts"),

  // OAuth 2.0 PKCE Endpoints
  route("api/oauth/register", "routes/api/oauth/register.ts"),
  route("api/oauth/authorize", "routes/api/oauth/authorize.tsx"),
  route("api/oauth/token", "routes/api/oauth/token.ts"),
  route("api/oauth/revoke", "routes/api/oauth/revoke.ts"),

  // Reusable REST APIs (/api/v1/*)
  ...prefix("api/v1", [
    route("metrics/revenue", "routes/api/v1/metrics/revenue.ts"),
    route("metrics/churn", "routes/api/v1/metrics/churn.ts"),
    route("health", "routes/api/v1/health.ts"),
    route("shops/recent", "routes/api/v1/shops/recent.ts"),
    route("shops", "routes/api/v1/shops/index.ts"),
    route("shops/detail", "routes/api/v1/shops/detail.ts"),
    route("shops/dev-status", "routes/api/v1/shops/dev-status.ts"),
    route("webhooks/failures", "routes/api/v1/webhooks/failures.ts"),
    route("tickets", "routes/api/v1/tickets/index.ts"),
    route("tickets/detail", "routes/api/v1/tickets/detail.ts"),
    route("tickets/reply", "routes/api/v1/tickets/reply.ts"),
    route("support/upload", "routes/api/v1/support/upload.ts"),
    route("audit", "routes/api/v1/audit.ts"),
  ]),

  // ── Resource routes ────────────────────────────────────────────────────────
  // Action-only endpoints with no UI of their own.
  route("locale", "routes/resources/locale.tsx"),
  // One file at a time, streamed to R2 — never through the reply form's own
  // multipart body. See the route for why.
  route("support/upload", "routes/resources/support-upload.tsx"),
  route("support/file/:id", "routes/resources/support-file.tsx"),
  // Streams a drafted reply into the staff console's composer.
  route("internal/ai/draft", "routes/resources/ai-draft.tsx"),

  // ── Webhooks ──────────────────────────────────────────────────────────────
  // URIs must match the subscriptions in BOTH shopify.app.toml files.
  ...prefix("webhooks", [
    route("app/uninstalled", "routes/webhooks/app/uninstalled.tsx"),
    route("app/scopes_update", "routes/webhooks/app/scopes-update.tsx"),
    // All three mandatory compliance topics share this endpoint.
    route("compliance", "routes/webhooks/compliance.tsx"),
  ]),
] satisfies RouteConfig;
