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
import Admins from "./admins";
import type { SafeAdminUser } from "~/db/schema";

/**
 * Renders the admins page through the real SSR path. Proves the removal
 * confirmation is a REAL form wired to the action, rather than a native
 * `window.confirm` (which cannot be styled, cannot be translated, and does not
 * exist during SSR).
 */
function admin(overrides: Partial<SafeAdminUser> = {}): SafeAdminUser {
  return {
    id: "other-id",
    email: "other@example.com",
    name: "Other Person",
    role: "admin",
    status: "active",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    lastLoginAt: null,
    ...overrides,
  };
}

const ACTOR = admin({ id: "actor-id", email: "me@example.com", name: "Me", role: "owner" });

async function render(locale: Locale, admins: SafeAdminUser[]) {
  const instance = createInstance();
  await instance.use(initReactI18next).init({ ...i18nOptions, lng: locale });

  const routes: RouteObject[] = [
    {
      path: "/internal/admins",
      Component: Admins,
      loader: () => ({ actor: ACTOR, admins }),
    },
  ];

  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request("https://example.test/internal/admins"),
  );
  if (context instanceof Response) {
    throw new Error(`Expected a render context, got ${context.status}`);
  }

  const html = renderToString(
    <I18nextProvider i18n={instance}>
      <StaticRouterProvider router={router(routes, context)} context={context} />
    </I18nextProvider>,
  );

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(500);
  return html;
}

// Small helper so the generic types stay readable above.
function router(routes: RouteObject[], context: Parameters<typeof createStaticRouter>[1]) {
  return createStaticRouter(routes, context);
}

describe("the removal confirmation", () => {
  it("renders a real form the dialog submits, not a native confirm()", async () => {
    const html = await render("en", [ACTOR, admin()]);

    // The hidden form the ConfirmDialog targets by id.
    expect(html).toContain('id="remove-admin"');
    // Its intent, so the action's dispatch reaches removeAdmin.
    expect(html).toContain('value="remove"');
  });

  it("offers no actions on your own row", async () => {
    // The guards would refuse them, so showing the buttons would be a lie.
    const html = await render("en", [ACTOR]);
    expect(html).toContain("Me");
    expect(html).not.toContain("Make owner");
    expect(html).not.toContain("Disable");
  });

  it("offers actions on someone else's row", async () => {
    const html = await render("en", [ACTOR, admin()]);
    expect(html).toContain("Disable");
    expect(html).toContain("Make owner");
    expect(html).toContain("Remove");
  });

  it("shows Enable for a disabled account, not Disable", async () => {
    const html = await render("en", [ACTOR, admin({ status: "disabled" })]);
    expect(html).toContain("Enable");
    expect(html).toContain("Disabled");
  });

  it("shows Make admin for an owner, not Make owner", async () => {
    const html = await render("en", [ACTOR, admin({ role: "owner" })]);
    expect(html).toContain("Make admin");
    expect(html).not.toContain("Make owner");
  });

  it("renders the whole page in Spanish", async () => {
    const html = await render("es", [ACTOR, admin()]);
    expect(html).toContain("Administradores");
    expect(html).toContain("Desactivar");
    expect(html).toContain("Eliminar");
    expect(html).not.toContain("Disable");
  });

  it("never renders a raw key path or an uninterpolated placeholder", async () => {
    for (const locale of ["en", "es"] as const) {
      const html = await render(locale, [ACTOR, admin()]);
      expect(html, locale).not.toMatch(/\badmins\.[a-zA-Z]+\.[a-zA-Z.]+/);
      expect(html, locale).not.toContain("{{");
    }
  });

  it("shows 'Never' rather than a blank cell for an account that never signed in", async () => {
    const html = await render("en", [ACTOR, admin({ lastLoginAt: null })]);
    expect(html).toContain("Never");
  });
});
