import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
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

async function render() {
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
    <StaticRouterProvider
      router={createStaticRouter(routes, context)}
      context={context}
    />,
  );

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(400);
  return html;
}

describe("the reset-password page", () => {
  it("renders both password fields in a real form, with no JS required", async () => {
    const html = await render();
    expect(html).toContain('name="newPassword"');
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain('method="post"');
  });

  it("enforces the length policy in the markup, not only on the server", async () => {
    const html = await render();
    expect(html).toContain('minLength="12"');
    expect(html).toContain("required");
  });

  it("names the person whose password is being reset", async () => {
    const html = await render();
    expect(html).toContain("Target Person");
  });

  it("offers a way back to the table", async () => {
    const html = await render();
    expect(html).toContain("/internal/admins");
  });
});
