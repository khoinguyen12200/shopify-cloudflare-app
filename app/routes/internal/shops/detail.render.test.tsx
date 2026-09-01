import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import ShopDetail from "./detail";
import type { Shop } from "~/db/schema";
import type { SubscriptionHistoryRow } from "~/models/shopify-events.server";

function shop(overrides: Partial<Shop> = {}): Shop {
  return {
    shop: "cool-shop.myshopify.com",
    shopifyShopId: null,
    relationshipStatus: null,
    relationshipOccurredAt: null,
    relationshipExternalId: null,
    installedAt: 1_700_000_000_000,
    currentInstalledAt: null,
    uninstalledAt: null,
    lastAuthenticatedAt: null,
    lastWebhookAt: null,
    lastReconciledAt: null,
    ...overrides,
  };
}

function event(overrides: Partial<SubscriptionHistoryRow> = {}): SubscriptionHistoryRow {
  return {
    id: "evt-1",
    shop: "cool-shop.myshopify.com",
    subscriptionId: "gid://shopify/AppSubscription/1",
    status: "ACTIVE",
    planHandle: "todo-pro",
    billingInterval: "EVERY_30_DAYS",
    priceAmount: 1900,
    priceCurrency: "USD",
    occurredAt: 1_700_000_000_000,
    ...overrides,
  };
}

async function render(data: { shop: Shop; history: SubscriptionHistoryRow[] }) {
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
    expect(html).toContain("todo-pro");
    expect(html).toContain("$19.00");
  });
});
