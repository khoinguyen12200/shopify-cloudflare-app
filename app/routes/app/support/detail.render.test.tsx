import { describe, expect, it } from "vitest";
import { err, ok } from "~/lib/result";
import { renderRoute } from "~/test/render-route";
import SupportThreadPage from "./detail";

const never = new Promise<never>(() => undefined);

const thread = {
  ticket: {
    id: "t1",
    subject: "Checkout is broken",
    category: "bug",
    status: "open",
    createdAt: Date.parse("2026-08-25T00:00:00.000Z"),
    ccEmails: [],
  },
  messages: [
    { id: "m1", author: "merchant", authorName: "Acme", body: "Cannot pay", createdAt: 1, attachments: [] },
  ],
};

const detail = (value: Promise<unknown>, stage: "pending" | "settled", locale: "en" | "es" = "en") =>
  renderRoute({ path: "/app/support/t1", Component: SupportThreadPage, loaderData: { thread: value }, stage, locale });

describe("streaming the ticket thread", () => {
  it("renders the frame, the way back and a labelled spinner while the thread is pending", async () => {
    const html = await detail(never, "pending");

    expect(html).toContain("<s-page");
    expect(html).toContain('slot="breadcrumb-actions"');
    expect(html).toContain('href="/app/support"');
    expect(html).toContain('accessibilityLabel="Loading the conversation"');
    expect(html).not.toContain("Cannot pay");
  });

  it("shows the subject as the heading and the conversation once it arrives", async () => {
    const html = await detail(Promise.resolve(ok(thread)), "settled");

    expect(html).toContain('<s-page heading="Checkout is broken"');
    expect(html).toContain("Cannot pay");
    expect(html).not.toContain("<s-spinner");
  });

  it("says the ticket was not found, instead of an empty thread, when the shop has no such ticket", async () => {
    const html = await detail(Promise.resolve(ok(null)), "settled");

    expect(html).toContain("We couldn&#x27;t find this ticket");
    expect(html).toContain('href="/app/support"');
    expect(html).not.toContain("Cannot pay");
  });

  it("shows a critical banner when the thread could not be loaded", async () => {
    const html = await detail(Promise.resolve(err("failed")), "settled");

    expect(html).toContain('tone="critical"');
    expect(html).toContain("We couldn&#x27;t load your tickets");
    expect(html).toContain('href="/app/support"');
  });

  it("translates the pending copy", async () => {
    const html = await detail(never, "pending", "es");
    expect(html).toContain('accessibilityLabel="Cargando la conversación"');
  });
});
