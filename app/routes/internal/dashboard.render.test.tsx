import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import Dashboard from "./dashboard";

type LoaderData = {
  user: { name: string };
  admins: number;
  stats: { totalShops: number; paidShops: number; freeShops: number; mrrByCurrency: { amount: number; currency: string }[] };
  trend: { month: string; installs: number; uninstalls: number; active: number }[];
  health: { failedWebhooks: number; deadLetterWebhooks: number; lifecycleEvents: number; subscriptionEvents: number; checkpoint: { lastSucceededAt: number | null; lastFailedAt: number | null } | null };
};

async function render(data: LoaderData) {
  const routes: RouteObject[] = [
    { path: "/internal/dashboard", Component: Dashboard, loader: () => data },
  ];
  const handler = createStaticHandler(routes);
  const context = await handler.query(new Request("https://example.test/internal/dashboard"));
  if (context instanceof Response) {
    throw new Error(`Expected a render context, got ${context.status}`);
  }
  const html = renderToString(
    <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />,
  );
  expect(html.length, "rendered nothing").toBeGreaterThan(200);
  return html;
}

describe("the internal dashboard", () => {
  it("shows shop counts and MRR", async () => {
    const html = await render({
      user: { name: "Jamie" },
      admins: 3,
      stats: { totalShops: 10, paidShops: 4, freeShops: 6, mrrByCurrency: [{ amount: 7600, currency: "USD" }] },
      trend: [{ month: "Jan", installs: 2, uninstalls: 0, active: 2 }],
      health: { failedWebhooks: 2, deadLetterWebhooks: 1, lifecycleEvents: 4, subscriptionEvents: 3, checkpoint: { lastSucceededAt: 100, lastFailedAt: null } },
    });
    expect(html).toContain("Jamie");
    expect(html).toContain("10");
    expect(html).toContain("4");
    expect(html).toContain("6");
    expect(html).toContain("$76.00");
  });

  it("renders the numbers WITHOUT pulling in the charts", async () => {
    // The charts are a lazy chunk mounted only in the browser, so the server
    // response must already carry the figures a staff member opens this page
    // for. If this ever starts containing chart markup, the split has been
    // undone and recharts is back on the critical path.
    const html = await render({
      user: { name: "Jamie" },
      admins: 3,
      stats: { totalShops: 10, paidShops: 4, freeShops: 6, mrrByCurrency: [] },
      trend: [{ month: "Jan", installs: 2, uninstalls: 1, active: 9 }],
      health: { failedWebhooks: 0, deadLetterWebhooks: 0, lifecycleEvents: 0, subscriptionEvents: 0, checkpoint: null },
    });

    expect(html).toContain("Installed shops");
    expect(html).not.toContain("recharts");
    expect(html).not.toContain("Merchant growth");
  });

  it("shows a zero MRR when nobody has paid yet", async () => {
    const html = await render({
      user: { name: "Jamie" },
      admins: 1,
      stats: { totalShops: 2, paidShops: 0, freeShops: 2, mrrByCurrency: [] },
      trend: [{ month: "Jan", installs: 0, uninstalls: 0, active: 0 }],
      health: { failedWebhooks: 0, deadLetterWebhooks: 0, lifecycleEvents: 0, subscriptionEvents: 0, checkpoint: null },
    });
    expect(html).toContain("$0.00");
  });

  it("shows operational health counts and checkpoint state", async () => {
    const html = await render({
      user: { name: "Jamie" }, admins: 1,
      stats: { totalShops: 1, paidShops: 0, freeShops: 1, mrrByCurrency: [] },
      trend: [],
      health: { failedWebhooks: 2, deadLetterWebhooks: 1, lifecycleEvents: 4, subscriptionEvents: 3, checkpoint: { lastSucceededAt: 100, lastFailedAt: null } },
    });
    expect(html).toContain("Webhook failures");
    expect(html).toContain("Dead-letter webhooks");
    expect(html).toContain("Last sync");
  });
});
