import { renderToReadableStream } from "react-dom/server";
import { ServerRouter, type EntryContext } from "react-router";
import { isbot } from "isbot";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { i18nServer, getLocale } from "~/i18n/i18n.server";
import { i18nOptions } from "~/i18n/options";
import { onPromiseSettled } from "~/lib/promise-settlement";

export const streamTimeout = 5000;

/**
 * Workers entry. The Node template used `renderToPipeableStream` +
 * `node:stream`; workerd has neither, so this uses the Web Streams renderer.
 *
 * A FRESH i18next instance is created per request. A shared module-level one
 * would leak the previous request's locale into this one — an isolate serves
 * many shops, and a Spanish merchant's page could render in English or vice
 * versa (@rules/architecture.md: no mutable module state).
 */
export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  reactRouterContext: EntryContext,
) {
  // Sets the embedded-app CSP (frame-ancestors for the shop + Shopify admin).
  createShopify(getEnv()).addDocumentResponseHeaders(request, responseHeaders);

  const locale = await getLocale(request);
  const instance = createInstance();

  await instance.use(initReactI18next).init({
    ...i18nOptions,
    lng: locale,
    // Only the namespaces the matched routes actually declare, so a public page
    // does not ship the admin strings.
    ns: i18nServer.getRouteNamespaces(reactRouterContext),
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), streamTimeout + 1000);

  let didError = false;
  const stream = await renderToReadableStream(
    <I18nextProvider i18n={instance}>
      <ServerRouter context={reactRouterContext} url={request.url} />
    </I18nextProvider>,
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

  onPromiseSettled(stream.allReady, () => clearTimeout(timeout));

  responseHeaders.set("Content-Type", "text/html");
  return new Response(stream, {
    headers: responseHeaders,
    status: didError ? 500 : responseStatusCode,
  });
}
