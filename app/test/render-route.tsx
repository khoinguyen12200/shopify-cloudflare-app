import type { ComponentType } from "react";
import { renderToReadableStream, renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { i18nOptions } from "~/i18n/options";

type RenderRouteOptions = {
  readonly path: string;
  readonly Component: ComponentType;
  /** What the route's loader returns; streamed regions are promises, as in production. */
  readonly loaderData: unknown;
  readonly locale?: "en" | "es";
  /**
   * `"pending"` renders what the merchant sees before any streamed region has
   * resolved (the Suspense fallbacks). `"settled"` waits for every region and
   * renders the page after the stream finishes.
   */
  readonly stage: "pending" | "settled";
};

/**
 * Renders a route component through React Router's static handler with a fixed
 * loader result. Nothing is mocked: the real `Await` / `Suspense` machinery
 * runs, which is what the streaming behaviour under test is made of.
 *
 * Polaris elements render as inert tags, so assertions are about what the page
 * decided (which branch, which string), not how it looks.
 */
export async function renderRoute({ path, Component, loaderData, locale = "en", stage }: RenderRouteOptions): Promise<string> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ ...i18nOptions, lng: locale });

  const routes: RouteObject[] = [{ path, Component, loader: () => loaderData }];
  const context = await createStaticHandler(routes).query(new Request(`https://example.test${path}`));
  if (context instanceof Response) throw new Error(`Expected a render context, got ${context.status}`);

  const tree = (
    <I18nextProvider i18n={instance}>
      <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} hydrate={false} />
    </I18nextProvider>
  );

  const html = stage === "pending" ? renderToString(tree) : await renderToSettledHtml(tree);
  if (html.trim() === "") throw new Error("rendered nothing — assertions would be vacuous");
  return html;
}

async function renderToSettledHtml(tree: React.ReactElement): Promise<string> {
  const stream = await renderToReadableStream(tree);
  await stream.allReady;
  return new Response(stream).text();
}
