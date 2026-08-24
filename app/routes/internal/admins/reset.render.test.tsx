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
import { i18nOptions } from "~/i18n/options";
import type { Locale } from "~/i18n/config";
import ResetAdminPassword from "./reset";

const TARGET = {
  id: "target-id",
  email: "target@example.com",
  name: "Target Person",
  role: "admin" as const,
  status: "active" as const,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  lastLoginAt: null,
};

async function render(locale: Locale) {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ ...i18nOptions, lng: locale });

  const routes: RouteObject[] = [
    {
      path: "/internal/admins/:adminId/reset",
      Component: ResetAdminPassword,
      loader: () => ({ target: TARGET }),
    },
  ];

  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request("https://example.test/internal/admins/target-id/reset"),
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

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(400);
  return html;
}

describe("the reset-password page", () => {
  it("renders both password fields in a real form, with no JS required", async () => {
    const html = await render("en");
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('method="post"');
  });

  it("enforces the length policy in the markup, not only on the server", async () => {
    const html = await render("en");
    expect(html).toContain('minLength="12"');
    expect(html).toContain("required");
  });

  it("names the person whose password is being reset", async () => {
    const html = await render("en");
    expect(html).toContain("Target Person");
  });

  it("offers a way back to the table", async () => {
    const html = await render("en");
    expect(html).toContain("/internal/admins");
  });

  it("renders in Spanish", async () => {
    const html = await render("es");
    expect(html).toContain("Restablecer la contraseña");
    expect(html).toContain("Contraseña nueva");
    expect(html).not.toContain("New password");
  });

  it("never leaks a raw key path or an uninterpolated placeholder", async () => {
    for (const locale of ["en", "es"] as const) {
      const html = await render(locale);
      expect(html, locale).not.toMatch(/\badmins\.[a-zA-Z]+\.[a-zA-Z.]+/);
      expect(html, locale).not.toContain("{{");
    }
  });
});
