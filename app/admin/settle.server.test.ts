import { afterEach, describe, expect, it, vi } from "vitest";
import { hashShop } from "~/observability/shop-log";
import { settle } from "./settle.server";

const context = { event: "admin.test.region.failed", shop: "shop-one.myshopify.com", route: "app/test" };

/** Captures `console.log` lines, parsed; the spy is restored after each test. */
function captureLogs(): { events: () => Record<string, unknown>[]; count: () => number } {
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    lines.push(String(line));
  });
  return { events: () => lines.map((line) => JSON.parse(line)), count: () => lines.length };
}

afterEach(() => vi.restoreAllMocks());

describe("settle", () => {
  it("hands the value through as ok, and logs nothing", async () => {
    const log = captureLogs();
    await expect(settle(Promise.resolve({ plan: "pro" }), context)).resolves.toEqual({ ok: true, value: { plan: "pro" } });
    expect(log.count()).toBe(0);
  });

  it("turns a rejection into a failed value instead of rejecting", async () => {
    captureLogs();
    await expect(settle(Promise.reject(new TypeError("boom")), context)).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("logs one structured event with the route and a hashed shop, never the domain or the message", async () => {
    const log = captureLogs();
    await settle(Promise.reject(new TypeError("customer jane@doe.com not found")), context);

    const events = log.events();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      event: "admin.test.region.failed",
      shopHash: await hashShop(context.shop),
      route: "app/test",
      errorName: "TypeError",
      status: null,
    });
    expect(JSON.stringify(events)).not.toContain("shop-one");
    expect(JSON.stringify(events)).not.toContain("jane@doe.com");
  });

  it("records the status of a thrown Response, such as the library's 401", async () => {
    const log = captureLogs();
    await expect(settle(Promise.reject(new Response("no", { status: 401 })), context)).resolves.toEqual({ ok: false, reason: "failed" });
    expect(log.events()[0]).toMatchObject({ errorName: "Response", status: 401 });
  });

  it("survives a non-Error rejection", async () => {
    const log = captureLogs();
    await expect(settle(Promise.reject("nope"), context)).resolves.toEqual({ ok: false, reason: "failed" });
    expect(log.events()[0]).toMatchObject({ errorName: "string", status: null });
  });
});
