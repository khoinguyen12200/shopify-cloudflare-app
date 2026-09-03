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

type EventHistoryRow = {
  readonly id: string;
  readonly kind: string;
  readonly status: string;
  readonly occurredAt: number;
  readonly detail: string;
};

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

async function render(data: { shop: Shop; history: SubscriptionHistoryRow[]; events: EventHistoryRow[]; reconciliation?: { lastSucceededAt: number | null; lastFailedAt: number | null; failureCode: string | null; failureDetail: string | null } | null }) {
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
    const html = await render({ shop: shop(), history: [], events: [] });
    expect(html).toContain("cool-shop.myshopify.com");
    expect(html).toContain("Active");
    expect(html).toContain("No subscription activity for this shop yet.");
  });

  it("shows uninstalled status and date", async () => {
    const html = await render({ shop: shop({ uninstalledAt: 1_700_100_000_000 }), history: [], events: [] });
    expect(html).toContain("Uninstalled");
  });

  it("shows subscription history without implying event prices", async () => {
    const html = await render({ shop: shop(), history: [event()], events: [] });
    expect(html).toContain("todo-pro");
    expect(html).not.toContain(">Price<");
    expect(html).not.toContain("$19.00");
  });

  it("shows all shop event history", async () => {
    const html = await render({
      shop: shop(),
      history: [],
      events: [{ id: "delivery-1", kind: "Webhook: app/uninstalled", status: "processed", occurredAt: 1_700_000_000_000, detail: "delivery-1" }],
    });
    expect(html).toContain("Event history");
    expect(html).toContain("Webhook: app/uninstalled");
    expect(html).toContain("processed");
  });

  it("shows the latest Partner reconciliation failure", async () => {
    const html = await render({ shop: shop(), history: [], events: [], reconciliation: { lastSucceededAt: null, lastFailedAt: 1_700_000_000_000, failureCode: "HISTORY_SYNC_FAILED", failureDetail: "Manage apps required" } });
    expect(html).toContain("Partner reconciliation failed");
    expect(html).toContain("Manage apps required");
  });
});
