import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { SignOutControl } from "./_layout";

describe("the internal user menu", () => {
  it("submits sign-out with POST rather than navigating to logout", () => {
    const router = createMemoryRouter([{ path: "/", element: <SignOutControl /> }]);
    const html = renderToStaticMarkup(<RouterProvider router={router} />);

    expect(html).toContain('action="/internal/logout"');
    expect(html).toContain('method="post"');
    expect(html).toContain('type="submit"');
    expect(html).not.toContain('href="/internal/logout"');
  });
});
