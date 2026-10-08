import { isRouteErrorResponse } from "react-router";

export type RequestErrorLog = Readonly<{
  event: "request.error";
  method: string;
  path: string;
  errorName: string;
  error: string;
  stack: string | null;
}>;

/**
 * What to log for an error that escaped a request, or `null` when it is not worth a line.
 *
 * Aborted requests (the client went away) and 4xx route errors — an unmatched path, a probe for `/.git/config`, a
 * deliberate 404 — are the caller's doing, not a fault, and logging them at error level buries real failures.
 * Only the path is recorded: the query string of an embedded request carries `id_token` and `hmac`.
 */
export function describeRequestError(error: unknown, request: Request): RequestErrorLog | null {
  if (request.signal.aborted) return null;
  if (isRouteErrorResponse(error) && error.status < 500) return null;
  const known = error instanceof Error;
  return {
    event: "request.error",
    method: request.method,
    path: new URL(request.url).pathname,
    errorName: known ? error.name : typeof error,
    error: known ? error.message : String(error),
    stack: known ? error.stack ?? null : null,
  };
}
