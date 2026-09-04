import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return {
    ...actual,
    Links: () => null,
    Meta: () => null,
    Outlet: () => <main>Home</main>,
    Scripts: () => null,
    ScrollRestoration: () => null,
    useLoaderData: () => ({ locale: "en" }),
  };
});

import Root from "./root";

function renderRootDocument() {
  const html = renderToStaticMarkup(<Root />);

  expect(html).toContain("<html");
  expect(html).toContain('name="viewport"');
  expect(html).toContain("<main>Home</main>");
  return html;
}

describe("root document assets", () => {
  it("does not load surface-specific stylesheets or preconnects", async () => {
    const html = renderRootDocument();

    expect(html).not.toContain("https://cdn.shopify.com/");
    expect(html).not.toContain(
      "https://cdn.shopify.com/static/fonts/inter/v4/styles.css",
    );
    expect(html).not.toContain("styles/public/public.scss");
    expect(html).not.toContain("internal.tailwind.css");
  });
});
