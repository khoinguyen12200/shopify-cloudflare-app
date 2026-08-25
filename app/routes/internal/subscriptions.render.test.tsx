import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import Subscriptions from "./subscriptions";
import type { SubscriptionEvent } from "~/db/schema";

function event(overrides: Partial<SubscriptionEvent> = {}): SubscriptionEvent {
  return {
    id: "evt-1",
    shop: "example.myshopify.com",
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

async function render(events: SubscriptionEvent[]) {
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
    expect(html).toContain("TODO:PRO");
    expect(html).toContain("Active");
  });

  it("shows an empty state with no history yet", async () => {
    const html = await render([]);
    expect(html).toContain("No subscription activity yet");
  });

  it("renders every documented status with a real label", async () => {
    const statuses: SubscriptionEvent["status"][] = [
      "ACTIVE",
      "CANCELLED",
      "PENDING",
      "DECLINED",
      "EXPIRED",
      "FROZEN",
      "ACCEPTED",
    ];
    const html = await render(statuses.map((status, i) => event({ id: `evt-${i}`, status })));
    for (const label of [
      "Active",
      "Cancelled",
      "Pending approval",
      "Declined",
      "Expired",
      "Frozen",
      "Accepted",
    ]) {
      expect(html, label).toContain(label);
    }
  });
});
