import { ApiVersion } from "@shopify/shopify-app-react-router/server";

/**
 * The Admin API / webhook version, in ONE place. It is a single decision with
 * `api_version` in `shopify.app.toml` and `shopify.app.dev.toml`; change the
 * three together. (The Partner API is versioned separately — see
 * `SHOPIFY_PARTNER_API_VERSION` in `wrangler.jsonc`.)
 *
 * Kept in its own module so `.graphqlrc.ts` (GraphQL codegen) can read it
 * without importing `shopify.server.ts` and its whole runtime graph.
 */
export const apiVersion = ApiVersion.October26;
