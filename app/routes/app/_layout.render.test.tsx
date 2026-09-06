import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { createStaticHandler, createStaticRouter, StaticRouterProvider, type RouteObject } from "react-router";
import { i18nOptions } from "~/i18n/options";
import App from "./_layout";

describe("Shopify admin navigation", () => {
  it("uses the current Polaris app-nav web component", async () => {
    const instance = createInstance();
    await instance.use(initReactI18next).init({ ...i18nOptions, lng: "en" });
    const routes: RouteObject[] = [{ path: "/app", Component: App, loader: () => ({ apiKey: "test" }) }];
    const context = await createStaticHandler(routes).query(new Request("https://example.test/app"));
    if (context instanceof Response) throw new Error("Expected render context");
    const html = renderToString(
      <I18nextProvider i18n={instance}>
        <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />
      </I18nextProvider>,
    );
    expect(html).toContain("s-app-nav");
    expect(html).toContain('rel="home"');
    expect(html).toContain("s-link");
    expect(html).not.toContain("NavMenu");
  });
});
