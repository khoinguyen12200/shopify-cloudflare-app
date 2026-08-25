import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { i18nOptions } from "~/i18n/options";
import { runWithRequestContext } from "~/request-context.server";
import Auth, { loader } from "./login";

/**
 * The shop-domain error used to be a hardcoded English string
 * (`login-error.server.tsx`). This proves it now comes through `t()`.
 */
async function render(url: string, locale: "en" | "es") {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ ...i18nOptions, lng: locale });

  const routes: RouteObject[] = [{ path: "/auth/login", Component: Auth, loader }];
  const handler = createStaticHandler(routes);
  const context = await runWithRequestContext(env, () =>
    handler.query(new Request(url)),
  );
  if (context instanceof Response) {
    throw new Error(`Expected a render context, got ${context.status}`);
  }

  const html = renderToString(
    <I18nextProvider i18n={instance}>
      <StaticRouterProvider
        router={createStaticRouter(routes, context)}
        context={context}
      />
    </I18nextProvider>,
  );

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(200);
  return html;
}

describe("the login shop-domain error", () => {
  it("translates to Spanish rather than showing hardcoded English", async () => {
    const html = await render(
      "https://example.test/auth/login?shop=not%20a%20valid%20shop",
      "es",
    );
    expect(html).toContain("Introduce un dominio de tienda válido para iniciar sesión");
    expect(html).not.toContain("Please enter a valid shop domain");
  });

  it("never renders a raw key path or an uninterpolated placeholder", async () => {
    for (const locale of ["en", "es"] as const) {
      const html = await render(
        "https://example.test/auth/login?shop=not%20a%20valid%20shop",
        locale,
      );
      expect(html, locale).not.toMatch(/\blogin\.[a-zA-Z]+\.[a-zA-Z.]+/);
      expect(html, locale).not.toContain("{{");
    }
  });
});
