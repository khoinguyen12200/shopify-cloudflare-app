import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import ShopDetail from "./detail";
import type { Shop, SubscriptionEvent } from "~/db/schema";

function shop(overrides: Partial<Shop> = {}): Shop {
  return { shop: "cool-shop.myshopify.com", installedAt: 1_700_000_000_000, uninstalledAt: null, ...overrides };
}

function event(overrides: Partial<SubscriptionEvent> = {}): SubscriptionEvent {
  return {
    id: "evt-1",
    shop: "cool-shop.myshopify.com",
    subscriptionId: "gid://shopify/AppSubscription/1",
    name: "TODO:PRO",
    status: "ACTIVE",
    planHandle: "todo-pro",
    interval: "every_30_days",
    priceAmount: 1900,
    priceCurrency: "USD",
    cappedAmountAmount: null,
    cappedAmountCurrency: null,
    shopifyCreatedAt: 1_700_000_000_000,
    shopifyUpdatedAt: 1_700_000_000_000,
    receivedAt: 1_700_000_001_000,
    ...overrides,
  };
}

async function render(data: { shop: Shop; history: SubscriptionEvent[] }) {
  const routes: RouteObject[] = [
    { path: "/internal/shops/:shop", Component: ShopDetail, loader: () => data },
  ];
  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request("https://example.test/internal/shops/cool-shop.myshopify.com"),
  );
  if (context instanceof Response) {
    throw new Error(`Expected a render context, got ${context.status}`);
  }
  const html = renderToString(
    <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />,
  );
  expect(html.length, "rendered nothing").toBeGreaterThan(200);
  return html;
}

describe("the internal shop detail page", () => {
  it("shows the shop domain and install status", async () => {
    const html = await render({ shop: shop(), history: [] });
    expect(html).toContain("cool-shop.myshopify.com");
    expect(html).toContain("Active");
    expect(html).toContain("No subscription activity for this shop yet.");
  });

  it("shows uninstalled status and date", async () => {
    const html = await render({ shop: shop({ uninstalledAt: 1_700_100_000_000 }), history: [] });
    expect(html).toContain("Uninstalled");
  });

  it("shows subscription history with plan, status and price", async () => {
    const html = await render({ shop: shop(), history: [event()] });
    expect(html).toContain("TODO:PRO");
    expect(html).toContain("$19.00");
  });
});
