import { describe, it, expect, vi } from "vitest";
import { renderToString, renderToReadableStream } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import Dashboard from "./dashboard";
import { streamRegion } from "~/internal/stream-region.server";

type Health = {
  failedWebhooks: number;
  deadLetterWebhooks: number;
  lifecycleEvents: number;
  subscriptionEvents: number;
  checkpoint: null;
};

const HEADLINE = {
  admins: 3,
  stats: { totalShops: 10, paidShops: 4, freeShops: 6, mrrByCurrency: [] },
};
const CHARTS = { trend: [{ month: "Jan", installs: 2, uninstalls: 0, active: 2 }], uninstallFeedback: [] };
const HEALTH: Health = { failedWebhooks: 0, deadLetterWebhooks: 0, lifecycleEvents: 0, subscriptionEvents: 0, checkpoint: null };

function loaderData(regions: { headline: Promise<unknown>; health: Promise<unknown>; charts: Promise<unknown> }) {
  return { user: { name: "Jamie" }, ...regions };
}

async function tree(data: ReturnType<typeof loaderData>) {
  const routes: RouteObject[] = [
    { path: "/internal/dashboard", Component: Dashboard, loader: () => data },
  ];
  const context = await createStaticHandler(routes).query(
    new Request("https://example.test/internal/dashboard"),
  );
  if (context instanceof Response) throw new Error(`unexpected ${context.status}`);
  return <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />;
}

async function streamed(data: ReturnType<typeof loaderData>): Promise<string> {
  const stream = await renderToReadableStream(await tree(data));
  await stream.allReady;
  return new Response(stream).text();
}

describe("dashboard streaming", () => {
  it("paints the page frame and skeletons while every region is still pending", async () => {
    const never = new Promise<never>(() => {});
    const html = renderToString(await tree(loaderData({ headline: never, health: never, charts: never })));

    // The frame is there immediately...
    expect(html).toContain("Dashboard");
    expect(html).toContain("Signed in as Jamie");
    // ...but no number is: a pending stat must not be rendered as a value.
    expect(html).not.toContain("Installed shops");
    expect(html).not.toContain("Webhook failures");
    expect(html).toContain("animate-pulse");
  });

  it("shows every region's data once it resolves", async () => {
    const html = await streamed(
      loaderData({ headline: Promise.resolve(HEADLINE), health: Promise.resolve(HEALTH), charts: Promise.resolve(CHARTS) }),
    );
    expect(html).toContain("Installed shops");
    expect(html).toContain("Webhook failures");
  });

  it("degrades a failed region to an error state and logs the event", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = streamRegion("dashboard", "health", Promise.reject(new Error("d1 down")));
    const html = await streamed(
      loaderData({ headline: Promise.resolve(HEADLINE), health: failing, charts: Promise.resolve(CHARTS) }),
    );

    expect(html).toContain("Installed shops");
    expect(html).toMatch(/role="alert"[^>]*>Operational health(<!-- -->)? could not be loaded/);
    expect(html).not.toContain("Webhook failures");
    const logged = log.mock.calls.map((call) => String(call[0]));
    expect(
      logged.some(
        (line) =>
          line.includes("internal.region_failed") && line.includes('"route":"dashboard"') && line.includes('"region":"health"'),
      ),
    ).toBe(true);
    log.mockRestore();
  });

  it("never shows a headline number when the headline failed to load", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = streamRegion("dashboard", "overview", Promise.reject(new Error("d1 down")));
    const html = await streamed(
      loaderData({ headline: failing, health: Promise.resolve(HEALTH), charts: Promise.resolve(CHARTS) }),
    );
    expect(html).toMatch(/role="alert"[^>]*>Headline numbers(<!-- -->)? could not be loaded/);
    expect(html).not.toContain("Installed shops");
    expect(html).not.toContain("$0.00");
    log.mockRestore();
  });
});
