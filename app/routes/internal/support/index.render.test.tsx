import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type RouteObject,
} from "react-router";
import InternalSupport from "./index";

type Row = {
  id: string;
  shop: string;
  shopName: string;
  subject: string;
  category: "bug" | "question" | "feature_request" | "billing";
  status: "open" | "answered" | "closed";
  lastMessageAt: number;
  planName: string;
  unread: boolean;
};

function row(over: Partial<Row> = {}): Row {
  return {
    id: "t1",
    shop: "alpha.myshopify.com",
    shopName: "Alpha Store",
    subject: "Checkout is broken",
    category: "bug",
    status: "open",
    lastMessageAt: 1_700_000_000_000,
    planName: "TODO:PRO",
    unread: false,
    ...over,
  };
}

async function render(data: { tickets: Row[]; notifySupport: boolean }) {
  const routes: RouteObject[] = [
    { path: "/internal/support", Component: InternalSupport, loader: () => data },
  ];

  const handler = createStaticHandler(routes);
  const context = await handler.query(
    new Request("https://example.test/internal/support"),
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

  expect(html.length, "rendered nothing — assertions would be vacuous").toBeGreaterThan(400);
  return html;
}

describe("the internal support queue", () => {
  it("shows the shop, subject and the plan that shop is on", async () => {
    // The plan column is the point of this screen: a billing question has to be
    // answerable without opening a second page.
    const html = await render({ tickets: [row()], notifySupport: true });
    expect(html).toContain("Checkout is broken");
    expect(html).toContain("Alpha Store");
    expect(html).toContain("TODO:PRO");
  });

  it("labels status by whose turn it is, not by a raw enum", async () => {
    const html = await render({ tickets: [row({ status: "open" })], notifySupport: true });
    expect(html).toContain("Needs reply");
    expect(html).not.toContain(">open<");
  });

  it("says a thread is waiting on the merchant once we have replied", async () => {
    const html = await render({
      tickets: [row({ status: "answered" })],
      notifySupport: true,
    });
    expect(html).toContain("Waiting on merchant");
  });

  it("marks an unread thread, and leaves a read one unmarked", async () => {
    const unread = await render({ tickets: [row({ unread: true })], notifySupport: true });
    expect(unread).toContain("New");

    const read = await render({ tickets: [row({ unread: false })], notifySupport: true });
    // The word only appears as the unread badge on this screen.
    expect(read).not.toContain(">New<");
  });

  it("falls back to the shop domain when no shop name was captured", async () => {
    const html = await render({
      tickets: [row({ shopName: "" })],
      notifySupport: true,
    });
    expect(html).toContain("alpha.myshopify.com");
  });

  it("shows an empty state rather than a bare table when nothing is open", async () => {
    const html = await render({ tickets: [], notifySupport: true });
    expect(html).toContain("No open tickets");
    expect(html).not.toContain("Last activity");
  });

  it("reflects the signed-in person's own email preference", async () => {
    const on = await render({ tickets: [], notifySupport: true });
    expect(on).toContain("Email me about tickets");
  });
});
