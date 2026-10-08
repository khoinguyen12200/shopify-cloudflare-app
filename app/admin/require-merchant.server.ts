import { isSafeHostParameter } from "~/lib/shopify-host";
import { getEnv } from "~/request-context.server";
import { createShopify } from "~/shopify.server";

/**
 * `authenticate.admin` for every embedded entry. Shopify's host sanitiser throws on a malformed `host` parameter
 * (see `isSafeHostParameter`), which would surface as a 500; that is the caller's mistake, so answer 400 first.
 * Every other outcome, including the library's own redirect and 401 Responses, passes through untouched.
 */
export async function authenticateAdmin(request: Request) {
  const host = new URL(request.url).searchParams.get("host");
  if (host !== null && !isSafeHostParameter(host)) throw new Response("Invalid host parameter", { status: 400 });
  return createShopify(getEnv()).authenticate.admin(request);
}
