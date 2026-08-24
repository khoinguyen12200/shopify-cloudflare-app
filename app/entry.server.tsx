import { renderToReadableStream } from "react-dom/server";
import { ServerRouter, type EntryContext } from "react-router";
import { isbot } from "isbot";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";

export const streamTimeout = 5000;

/**
 * Workers entry. The Node template used `renderToPipeableStream` +
 * `node:stream`; workerd has neither, so we use the Web Streams renderer.
 */
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  // Sets the embedded-app CSP (frame-ancestors for the shop + Shopify admin).
  createShopify(getEnv()).addDocumentResponseHeaders(request, responseHeaders);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), streamTimeout + 1000);

  let didError = false;
  const stream = await renderToReadableStream(
    <ServerRouter context={reactRouterContext} url={request.url} />,
    {
      signal: controller.signal,
      onError(error: unknown) {
        didError = true;
        console.error(error);
      },
    },
  );

  // Bots need the whole document (SEO / link unfurling); browsers get the shell
  // as soon as it is ready.
  if (isbot(request.headers.get("user-agent") ?? "")) {
    await stream.allReady;
  }

  stream.allReady.then(() => clearTimeout(timeout));

  responseHeaders.set("Content-Type", "text/html");
  return new Response(stream, {
    headers: responseHeaders,
    status: didError ? 500 : responseStatusCode,
  });
}
