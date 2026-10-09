import { describe, it, expect, vi } from "vitest";
import type { ComponentType } from "react";
import { renderToString, renderToReadableStream } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import { streamRegion } from "~/internal/stream-region.server";
import { TOOL_CATALOG } from "~/mcp/catalog";
import { MODEL_ROLES } from "~/ai/roles";
import type { SafeAdminUser } from "~/db/schema";
import Shops from "./shops/index";
import ShopDetail from "./shops/detail";
import Subscriptions from "./subscriptions";
import InternalSupport from "./support/index";
import InternalSupportThread from "./support/detail";
import NewInternalSupportTicket from "./support/new";
import Admins from "./admins/index";
import ResetAdminPassword from "./admins/reset";
import AiSettings from "./ai";
import McpAdmin from "./mcp";
import { buildPurpose } from "./ai/purposes";

/**
 * The same four guarantees for every streamed page, driven by one table so a
 * newly streamed page cannot skip them:
 *   (a) the page FRAME renders while data is pending, with a skeleton and no data;
 *   (b) the data appears once the promise resolves;
 *   (c) a rejected promise shows that region's error state and logs a structured
 *       event, while the frame survives;
 * (d) — owner-only 403 — lives in loaders.integration.test.ts, where real auth runs.
 */
const ACTOR: SafeAdminUser = {
  id: "actor-id",
  email: "me@workmanjsc.vn",
  name: "Me",
  role: "owner",
  status: "active",
  notifySupport: true,
  createdAt: 1,
  updatedAt: 1,
  lastLoginAt: null,
};

interface PageCase {
  readonly name: string;
  readonly path: string;
  readonly url: string;
  readonly Component: ComponentType;
  /** Loader fields that are NOT streamed (they come from the awaited auth lookup or the URL). */
  readonly immediate: Record<string, unknown>;
  /** The streamed region the page's primary data lives in. */
  readonly region: string;
  readonly resolved: unknown;
  /** Visible while pending: proves the frame rendered. */
  readonly frame: string;
  /** Visible only once the region's data has arrived. */
  readonly data: string;
  readonly errorTitle: string;
}

const CASES: readonly PageCase[] = [
  {
    name: "shops",
    path: "/internal/shops",
    url: "/internal/shops",
    Component: Shops,
    immediate: {},
    region: "shops",
    resolved: [{ shop: "cool.myshopify.com", name: null, email: null, logoUrl: null, installedAt: 1, active: true, isDevStore: false, planName: "Free" }],
    frame: "Every shop that has ever installed this app.",
    data: "cool.myshopify.com",
    errorTitle: "The shops list",
  },
  {
    name: "shop detail",
    path: "/internal/shops/:shop",
    url: "/internal/shops/cool.myshopify.com",
    Component: ShopDetail,
    immediate: { shopDomain: "cool.myshopify.com" },
    region: "detail",
    resolved: null,
    frame: "cool.myshopify.com",
    data: "Shop not found",
    errorTitle: "This shop",
  },
  {
    name: "subscriptions",
    path: "/internal/subscriptions",
    url: "/internal/subscriptions",
    Component: Subscriptions,
    immediate: {},
    region: "events",
    resolved: [],
    frame: "Every plan change Shopify has told this app about",
    data: "No subscription activity yet",
    errorTitle: "Subscription history",
  },
  {
    name: "support queue",
    path: "/internal/support",
    url: "/internal/support",
    Component: InternalSupport,
    immediate: { notifySupport: true },
    region: "tickets",
    resolved: [],
    frame: "Email me about tickets",
    data: "No open tickets",
    errorTitle: "Open tickets",
  },
  {
    name: "support ticket",
    path: "/internal/support/:ticketId",
    url: "/internal/support/t1",
    Component: InternalSupportThread,
    immediate: { ticketId: "t1" },
    region: "detail",
    resolved: null,
    frame: "Support ticket",
    data: "Ticket not found",
    errorTitle: "This ticket",
  },
  {
    name: "new ticket",
    path: "/internal/support/new",
    url: "/internal/support/new",
    Component: NewInternalSupportTicket,
    immediate: { actorName: "Me" },
    region: "shops",
    resolved: [],
    frame: "New Support Ticket",
    data: "Create Ticket &amp; Email Merchant",
    errorTitle: "The shop list",
  },
  {
    name: "admins",
    path: "/internal/admins",
    url: "/internal/admins",
    Component: Admins,
    immediate: { actor: ACTOR, resetSuccess: false },
    region: "admins",
    resolved: [ACTOR],
    frame: "Who can sign in to this console",
    data: "Last sign-in",
    errorTitle: "The admins list",
  },
  {
    name: "reset password",
    path: "/internal/admins/:adminId/reset",
    url: "/internal/admins/target-id/reset",
    Component: ResetAdminPassword,
    immediate: { targetId: "target-id" },
    region: "target",
    resolved: { ...ACTOR, id: "target-id", name: "Target Person" },
    frame: "Reset admin password",
    data: "Target Person",
    errorTitle: "This admin",
  },
  {
    name: "ai",
    path: "/internal/ai",
    url: "/internal/ai",
    Component: AiSettings,
    immediate: {},
    region: "overview",
    resolved: {
      purposes: MODEL_ROLES.map((role) => buildPurpose(role, [], 0)),
      spend: { calls: 7, input: 1, output: 2 },
      runs: [],
    },
    frame: "Which models do which job",
    data: "Calls (30 days)",
    errorTitle: "AI settings",
  },
];

async function frameTree(page: PageCase, region: Promise<unknown> | unknown) {
  const routes: RouteObject[] = [
    {
      path: page.path,
      Component: page.Component,
      loader: () => ({ ...page.immediate, [page.region]: region }),
    },
  ];
  const context = await createStaticHandler(routes).query(new Request(`https://example.test${page.url}`));
  if (context instanceof Response) throw new Error(`unexpected ${context.status}`);
  return <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />;
}

async function streamed(page: PageCase, region: Promise<unknown>): Promise<string> {
  const stream = await renderToReadableStream(await frameTree(page, region));
  await stream.allReady;
  return new Response(stream).text();
}

describe.each(CASES)("$name streams its data", (page) => {
  it("paints the frame and a skeleton while the data is pending, with no data yet", async () => {
    const html = renderToString(await frameTree(page, new Promise<never>(() => {})));
    expect(html).toContain(page.frame);
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain(page.data);
  });

  it("shows the data once the promise resolves", async () => {
    const html = await streamed(page, Promise.resolve(page.resolved));
    expect(html).toContain(page.frame);
    expect(html).toContain(page.data);
  });

  it("shows an error state for a rejected region, logs it, and keeps the frame", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await streamed(page, streamRegion("test_route", "test_region", Promise.reject(new Error("d1 down"))));

    expect(html).toContain(page.frame);
    expect(html).toMatch(new RegExp(`role="alert"[^>]*>${page.errorTitle}(<!-- -->)? could not be loaded`));
    expect(html).not.toContain(page.data);
    const logged = log.mock.calls.map((call) => String(call[0]));
    expect(logged.some((line) => line.includes("internal.region_failed") && line.includes("test_route") && line.includes("test_region"))).toBe(true);
    log.mockRestore();
  });
});

describe("mcp streams its tokens and audit logs", () => {
  async function mcpTree(access: Promise<unknown>, auditLogs: Promise<unknown>) {
    const routes: RouteObject[] = [
      {
        path: "/internal/mcp",
        Component: McpAdmin,
        loader: () => ({ user: ACTOR, toolCatalog: TOOL_CATALOG, appUrl: "https://app.example.test", now: 1, access, auditLogs }),
      },
    ];
    const context = await createStaticHandler(routes).query(new Request("https://example.test/internal/mcp"));
    if (context instanceof Response) throw new Error(`unexpected ${context.status}`);
    return <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />;
  }

  it("paints the page and its default tab while neither region has arrived", async () => {
    const never = new Promise<never>(() => {});
    const html = renderToString(await mcpTree(never, never));
    expect(html).toContain("MCP &amp; REST API");
    expect(html).toContain("Quick Connect");
  });
});
