import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";
import { i18nOptions } from "./options";
import { SUPPORTED_LOCALES, type Locale } from "./config";
import Pricing from "~/routes/public/pricing";
import PrivacyPolicy from "~/routes/public/legal/privacy";
import Terms from "~/routes/public/legal/terms";

/**
 * Renders REAL page components through React SSR with a real i18next instance.
 *
 * Uses createStaticHandler/createStaticRouter — the actual server-rendering
 * path, which AWAITS loaders. `createRoutesStub` is for client tests: under
 * `renderToString` it returns an empty string, which silently turns every
 * positive assertion into a vacuous pass.
 *
 * (The Worker entry itself cannot be rendered here: it imports the Vite virtual
 * module `virtual:react-router/server-build`, which exists only in a real build.)
 */
async function renderAt(locale: Locale, Component: () => React.ReactNode) {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ ...i18nOptions, lng: locale });

  const routes: RouteObject[] = [
    {
      path: "/",
      Component,
      // Pages read their title from a loader; the locale comes from i18next.
      loader: () => ({ title: "t", appName: "app" }),
    },
  ];

  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request("https://example.test/"));
  if (context instanceof Response) {
    throw new Error(`Expected render context, got a ${context.status} response`);
  }
  const router = createStaticRouter(routes, context);

  const html = renderToString(
    <I18nextProvider i18n={instance}>
      <StaticRouterProvider router={router} context={context} />
    </I18nextProvider>,
  );

  // GUARD: an empty render must fail loudly, not quietly satisfy every
  // `.not.toContain()` below.
  expect(html.length, "rendered nothing — the assertions would be vacuous").toBeGreaterThan(200);
  return html;
}

const PAGES = [
  ["pricing", Pricing],
  ["privacy", PrivacyPolicy],
  ["terms", Terms],
] as const;

describe("pages render in the locale they are given", () => {
  it("renders the pricing page in English", async () => {
    const html = await renderAt("en", Pricing);
    expect(html).toContain("Pricing");
    expect(html).toContain("Get started");
    expect(html).toContain("per month");
  });

  it("renders the pricing page in Spanish, with no English left", async () => {
    const html = await renderAt("es", Pricing);
    expect(html).toContain("Precios");
    expect(html).toContain("Empezar");
    expect(html).toContain("al mes");
    expect(html).not.toContain("Get started");
    expect(html).not.toContain("per month");
  });

  it("renders the privacy policy's section headings in Spanish", async () => {
    const html = await renderAt("es", PrivacyPolicy);
    expect(html).toContain("Política de privacidad");
    expect(html).toContain("¿Qué datos personales recogemos?");
    expect(html).not.toContain("What personal data do we collect?");
  });

  it("renders the terms in both languages", async () => {
    expect(await renderAt("en", Terms)).toContain("Terms of service");
    expect(await renderAt("es", Terms)).toContain("Términos del servicio");
  });
});

describe("no page leaks untranslated output", () => {
  it.each(PAGES)("%s never renders a raw key path", async (_name, Component) => {
    // A missing key renders as "pricing.getStarted" — visible nonsense.
    for (const locale of SUPPORTED_LOCALES) {
      const html = await renderAt(locale, Component);
      expect(html, locale).not.toMatch(
        /\b(pricing|legal|landing|support|home|login)\.[a-zA-Z]+\.[a-zA-Z.]+/,
      );
    }
  });

  it.each(PAGES)("%s interpolates rather than printing braces", async (_n, Component) => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = await renderAt(locale, Component);
      expect(html, locale).not.toContain("{{");
    }
  });
});

describe("admin namespace resolves too", () => {
  it("returns Spanish admin strings", async () => {
    const instance = createInstance();
    await instance.use(initReactI18next).init({ ...i18nOptions, lng: "es" });

    function AdminBit() {
      const { t } = useTranslation("admin");
      return <span>{t("login.submit")}</span>;
    }

    const html = renderToString(
      <I18nextProvider i18n={instance}>
        <AdminBit />
      </I18nextProvider>,
    );
    expect(html).toContain("Iniciar sesión");
  });
});
