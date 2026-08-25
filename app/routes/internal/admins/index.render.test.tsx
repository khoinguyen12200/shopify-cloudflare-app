import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import Admins from "./index";
import type { SafeAdminUser } from "~/db/schema";

/**
 * Renders the admins page through the real SSR path. Proves the removal
 * confirmation is a REAL form wired to the action, rather than a native
 * `window.confirm` (which cannot be styled and does not exist during SSR).
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

async function render(admins: SafeAdminUser[]) {
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
    <StaticRouterProvider
      router={createStaticRouter(routes, context)}
      context={context}
    />,
  );

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(500);
  return html;
}

describe("the removal confirmation", () => {
  it("renders a real form the dialog submits, not a native confirm()", async () => {
    const html = await render([ACTOR, admin()]);

    // The hidden form the ConfirmDialog targets by id.
    expect(html).toContain('id="remove-admin"');
    // Its intent, so the action's dispatch reaches removeAdmin.
    expect(html).toContain('value="remove"');
  });

  it("offers no actions on your own row", async () => {
    // The guards would refuse them, so showing the buttons would be a lie.
    const html = await render([ACTOR]);
    expect(html).toContain("Me");
    expect(html).not.toContain("Make owner");
    expect(html).not.toContain("Disable");
  });

  it("offers actions on someone else's row", async () => {
    const html = await render([ACTOR, admin()]);
    expect(html).toContain("Disable");
    expect(html).toContain("Make owner");
    expect(html).toContain("Remove");
  });

  it("shows Enable for a disabled account, not Disable", async () => {
    const html = await render([ACTOR, admin({ status: "disabled" })]);
    expect(html).toContain("Enable");
    expect(html).toContain("Disabled");
  });

  it("shows Make admin for an owner, not Make owner", async () => {
    const html = await render([ACTOR, admin({ role: "owner" })]);
    expect(html).toContain("Make admin");
    expect(html).not.toContain("Make owner");
  });

  it("links to the reset page rather than embedding the field", async () => {
    // The field lives on its own route so it exists without JavaScript; a
    // dialog's contents only render once opened.
    const html = await render([ACTOR, admin()]);
    expect(html).toContain("/internal/admins/other-id/reset");
    expect(html).toContain("Reset password");
    expect(html).not.toContain('name="newPassword"');
  });

  it("offers no reset on your own row — /internal/profile is that path", async () => {
    const html = await render([ACTOR]);
    expect(html).not.toContain("Reset password");
    expect(html).not.toContain("/reset");
  });

  it("shows 'Never' rather than a blank cell for an account that never signed in", async () => {
    const html = await render([ACTOR, admin({ lastLoginAt: null })]);
    expect(html).toContain("Never");
  });
});
