import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import Shops from "./index";

type ShopRow = {
  shop: string;
  installedAt: number;
  active: boolean;
  planName: string;
};

async function render(shops: ShopRow[]) {
  const routes: RouteObject[] = [
    { path: "/internal/shops", Component: Shops, loader: () => ({ shops }) },
  ];
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request("https://example.test/internal/shops"));
  if (context instanceof Response) {
    throw new Error(`Expected a render context, got ${context.status}`);
  }
  const html = renderToString(
    <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />,
  );
  expect(html.length, "rendered nothing").toBeGreaterThan(200);
  return html;
}

describe("the internal shops list", () => {
  it("shows each shop with a link to its detail page", async () => {
    const html = await render([
      { shop: "cool-shop.myshopify.com", installedAt: 1_700_000_000_000, active: true, planName: "Free" },
    ]);
    expect(html).toContain("cool-shop.myshopify.com");
    expect(html).toContain("/internal/shops/cool-shop.myshopify.com");
    expect(html).toContain("Free");
    expect(html).toContain("Active");
  });

  it("shows an uninstalled shop as such", async () => {
    const html = await render([
      { shop: "gone.myshopify.com", installedAt: 1, active: false, planName: "Free" },
    ]);
    expect(html).toContain("Uninstalled");
  });

  it("shows an empty state with no shops yet", async () => {
    const html = await render([]);
    expect(html).toContain("No shops yet");
  });
});
