import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";

/**
 * The `/auth/*` splat, kept for the library's own bounce pages.
 *
 * It records NOTHING. This app authenticates by token exchange, so there is no
 * OAuth callback to complete and this loader is not part of installing —
 * recording the install here meant it was never recorded at all. The install is
 * written by the `afterAuth` hook in `~/shopify.server`, which is the moment
 * the app actually learns a shop has a session.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await createShopify(getEnv()).authenticate.admin(request);
  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
