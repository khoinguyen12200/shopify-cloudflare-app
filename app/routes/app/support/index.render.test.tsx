import { describe, it, expect } from "vitest";
import { err, ok } from "~/lib/result";
import { renderRoute } from "~/test/render-route";
import SupportIndex from "./index";

type Ticket = {
  id: string;
  subject: string;
  category: "bug" | "question" | "feature_request" | "billing";
  status: "open" | "answered" | "closed";
  lastMessageAt: number;
  unread: boolean;
};

const ticket = (over: Partial<Ticket> = {}): Ticket => ({
  id: "t1",
  subject: "Checkout is broken",
  category: "bug",
  status: "open",
  lastMessageAt: Date.parse("2026-08-25T00:00:00.000Z"),
  unread: false,
  ...over,
});

/**
 * The Polaris web components themselves cannot be meaningfully unit-tested —
 * they are custom elements the browser upgrades, and this renders them as inert
 * tags. What IS worth asserting is everything decided before they render: which
 * branch the page takes, which strings it chose, and that no English leaked past
 * `t()`. Layout is verified by hand (@rules/testing.md).
 */
async function render(tickets: Ticket[], locale: "en" | "es" = "en") {
  return renderRoute({
    path: "/app/support",
    Component: SupportIndex,
    loaderData: { tickets: Promise.resolve(ok(tickets)) },
    stage: "settled",
    locale,
  });
}

describe("the merchant's ticket list", () => {
  it("shows the empty state, not a table, when there are no tickets", async () => {
    const html = await render([]);

    expect(html).toContain("No tickets yet");
    expect(html).not.toContain("<s-table");
  });

  it("gives the empty state an illustration and a way forward", async () => {
    // An empty state that only apologises leaves the merchant nowhere to go.
    const html = await render([]);

    expect(html).toContain("/illustrations/support-empty.svg");
    expect(html).toContain("New ticket");
    expect(html).toContain("/app/support/new");
  });

  it("shows the table, not the empty state, once a ticket exists", async () => {
    const html = await render([ticket()]);

    expect(html).toContain("<s-table");
    expect(html).not.toContain("No tickets yet");
  });

  it("renders the table full-bleed, with the card supplying no padding", async () => {
    // The table draws its own header rule and row separators; inset inside a
    // padded card it reads as a box floating in a box.
    const html = await render([ticket()]);
    expect(html).toContain('padding="none"');
  });

  it("no longer carries the intro paragraph above the table", async () => {
    const html = await render([ticket()]);
    expect(html).not.toContain("Ask us anything");
  });

  it("labels status by whose turn it is, never a raw enum", async () => {
    const html = await render([ticket({ status: "open" })]);

    expect(html).toContain("Waiting on us");
    expect(html).not.toContain(">open<");
  });

  it("marks an unread ticket, and leaves a read one unmarked", async () => {
    expect(await render([ticket({ unread: true })])).toContain("New");

    const read = await render([
      ticket({ unread: false, subject: "Quiet one" }),
    ]);
    expect(read).toContain("Quiet one");
    expect(read).not.toContain(">New<");
  });

  it("links each row to its own thread", async () => {
    const html = await render([ticket({ id: "abc123" })]);
    expect(html).toContain("/app/support/abc123");
  });

  it("translates the empty state rather than hardcoding English", async () => {
    const html = await render([], "es");

    expect(html).not.toContain("No tickets yet");
    expect(html).not.toContain("New ticket");
  });
});

describe("streaming the ticket list", () => {
  const never = new Promise<never>(() => undefined);

  it("renders the heading and the New ticket action at once, with a labelled spinner for the list", async () => {
    const html = await renderRoute({ path: "/app/support", Component: SupportIndex, loaderData: { tickets: never }, stage: "pending" });

    expect(html).toContain('<s-page heading="Support"');
    expect(html).toContain('slot="primary-action"');
    expect(html).toContain('accessibilityLabel="Loading your tickets"');
    // Neither answer is shown before the data arrives.
    expect(html).not.toContain("No tickets yet");
    expect(html).not.toContain("<s-table");
  });

  it("replaces the spinner with the rows once the tickets arrive", async () => {
    const html = await render([ticket({ subject: "Refund stuck" })]);
    expect(html).toContain("Refund stuck");
    expect(html).not.toContain("<s-spinner");
  });

  it("shows a critical banner, not the empty state, when the tickets could not be loaded", async () => {
    // "No tickets yet" would be a plausible but wrong answer for a failed read.
    const html = await renderRoute({
      path: "/app/support",
      Component: SupportIndex,
      loaderData: { tickets: Promise.resolve(err("failed")) },
      stage: "settled",
    });

    expect(html).toContain('tone="critical"');
    expect(html).toContain("We couldn&#x27;t load your tickets");
    expect(html).not.toContain("No tickets yet");
    expect(html).toContain('<s-page heading="Support"');
  });

  it("translates the pending label", async () => {
    const html = await renderRoute({ path: "/app/support", Component: SupportIndex, loaderData: { tickets: never }, stage: "pending", locale: "es" });
    expect(html).toContain('accessibilityLabel="Cargando tus tickets"');
  });
});
