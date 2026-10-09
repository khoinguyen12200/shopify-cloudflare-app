import { describe, expect, it } from "vitest";
import { Deferred, FailedSection, PendingSection } from "./Deferred";
import { renderRoute } from "~/test/render-route";
import type { Outcome } from "~/admin/outcome";

const never = new Promise<never>(() => undefined);

function Probe({ region }: { region: Promise<Outcome<string>> }) {
  return (
    <Deferred
      resolve={region}
      pending={<PendingSection heading="Plans" label="Loading plans" />}
      failed={<FailedSection heading="Could not load" body="Reload the page." />}
    >
      {(value) => <s-section heading="Loaded">{value}</s-section>}
    </Deferred>
  );
}

const probe = (region: Promise<Outcome<string>>, stage: "pending" | "settled") =>
  renderRoute({ path: "/probe", Component: () => <Probe region={region} />, loaderData: {}, stage });

describe("Deferred", () => {
  it("shows a labelled spinner section while the region is pending, keeping the heading", async () => {
    const html = await probe(never, "pending");
    expect(html).toContain('<s-spinner size="large" accessibilityLabel="Loading plans"');
    expect(html).toContain('heading="Plans"');
    expect(html).not.toContain("Loaded");
  });

  it("shows the value, and no spinner, once the region resolves", async () => {
    const html = await probe(Promise.resolve({ ok: true, value: "42 tickets" }), "settled");
    expect(html).toContain("42 tickets");
    expect(html).not.toContain("<s-spinner");
  });

  it("shows a critical banner, not a value, when the region failed", async () => {
    const html = await probe(Promise.resolve({ ok: false, reason: "failed" }), "settled");
    expect(html).toContain('tone="critical"');
    expect(html).toContain("Could not load");
    expect(html).not.toContain("Loaded");
  });

  it("shows the same banner when the stream itself rejects (stream timeout)", async () => {
    const html = await probe(Promise.reject(new Error("Server timeout.")), "settled");
    expect(html).toContain('tone="critical"');
    expect(html).toContain("Could not load");
  });
});
