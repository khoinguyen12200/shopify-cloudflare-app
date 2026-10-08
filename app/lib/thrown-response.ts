import { isRouteErrorResponse } from "react-router";

/**
 * The body of a response a route THREW although it is not an error (status below 400), or `null` for anything else.
 *
 * `authenticate.admin` answers an embedded document request that has no `id_token` yet by throwing a 200 response whose
 * body loads App Bridge, which fetches a token and reloads the page. A thrown success response is not a failure; it is
 * the library handing the browser an instruction, and rendering its body is the only way the merchant gets past it.
 * Real failures (404, 500, a thrown `Error`) are not touched and fall through to the root boundary.
 *
 * Shopify's own `boundary.error` makes the same call by comparing `error.constructor.name` with "ErrorResponseImpl",
 * which a minified production bundle renames (here to `Be`), so it silently rethrew the bounce page and the merchant saw
 * "Something went wrong". `isRouteErrorResponse` is duck-typed on the response's fields and survives minification.
 */
export function thrownResponseHtml(error: unknown): string | null {
  if (!isRouteErrorResponse(error) || error.status >= 400) return null;
  return typeof error.data === "string" && error.data.length > 0 ? error.data : null;
}
