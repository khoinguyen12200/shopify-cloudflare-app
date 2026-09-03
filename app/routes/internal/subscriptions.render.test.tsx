import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import Subscriptions from "./subscriptions";
import type { SubscriptionHistoryRow } from "~/models/shopify-events.server";

function event(overrides: Partial<SubscriptionHistoryRow> = {}): SubscriptionHistoryRow {
  return {
    id: "evt-1",
    shop: "example.myshopify.com",
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

async function render(events: SubscriptionHistoryRow[]) {
  const routes: RouteObject[] = [
    {
      path: "/internal/subscriptions",
      Component: Subscriptions,
      loader: () => ({ events }),
    },
  ];

  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request("https://example.test/internal/subscriptions"),
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

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(200);
  return html;
}

describe("the internal subscriptions page", () => {
  it("shows the shop, plan, and status for each event", async () => {
    const html = await render([event()]);
    expect(html).toContain("example.myshopify.com");
    expect(html).toContain("todo-pro");
    expect(html).toContain("Active");
  });

  it("does not imply Shopify historical events include a price", async () => {
    const html = await render([event()]);
    expect(html).not.toContain(">Price<");
    expect(html).not.toContain("$19.00");
  });

  it("shows an empty state with no history yet", async () => {
    const html = await render([]);
    expect(html).toContain("No subscription activity yet");
  });

  it("renders every documented status with a real label", async () => {
    const statuses: SubscriptionHistoryRow["status"][] = [
      "ACTIVE",
      "CANCELLATION_SCHEDULED",
      "CANCELED",
      "NONE",
      "PENDING",
      "FROZEN",
      "UNKNOWN",
    ];
    const html = await render(statuses.map((status, i) => event({ id: `evt-${i}`, status })));
    for (const label of [
      "Active",
      "Cancellation scheduled",
      "Canceled",
      "Free",
      "Pending",
      "Frozen",
      "Unknown",
    ]) {
      expect(html, label).toContain(label);
    }
  });
});
