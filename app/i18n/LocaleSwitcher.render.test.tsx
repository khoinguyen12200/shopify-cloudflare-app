import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { i18nOptions } from "./options";
import { LocaleSwitcher } from "./LocaleSwitcher";

/**
 * Renders the switcher through the real SSR path.
 *
 * The `returnTo` value is what makes switching language keep you on the page
 * you were reading, and it is produced during the SERVER render — so this is
 * exactly the assertion that catches it being computed from `window`.
 */
async function renderAt(path: string) {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ ...i18nOptions, lng: "en" });

  const routes: RouteObject[] = [
    { path: "*", Component: () => <LocaleSwitcher current="en" /> },
  ];

  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request(`https://example.test${path}`));
  if (context instanceof Response) {
    throw new Error(`Expected render context, got a ${context.status} response`);
  }

  const html = renderToString(
    <I18nextProvider i18n={instance}>
      <StaticRouterProvider
        router={createStaticRouter(routes, context)}
        context={context}
      />
    </I18nextProvider>,
  );

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(120);
  return html;
}

describe("the language switcher", () => {
  it("returns the visitor to the page they are on, not the home page", async () => {
    const html = await renderAt("/pricing");
    expect(html).toContain('value="/pricing"');
  });

  it("keeps the query string of the page they are on", async () => {
    const html = await renderAt("/support?topic=billing");
    expect(html).toContain('value="/support?topic=billing"');
  });

  it("posts to the locale resource route", async () => {
    const html = await renderAt("/pricing");
    expect(html).toContain('action="/locale"');
    expect(html).toContain('method="post"');
  });

  it("offers every supported language", async () => {
    const html = await renderAt("/");
    expect(html).toContain('value="en"');
    expect(html).toContain('value="es"');
  });

  it("labels the control for a screen reader without showing the label", async () => {
    const html = await renderAt("/");
    expect(html).toContain("visually-hidden");
    expect(html).toContain('for="locale-switcher"');
  });
});
