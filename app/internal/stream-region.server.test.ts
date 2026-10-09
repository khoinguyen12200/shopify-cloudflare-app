import { describe, it, expect, vi } from "vitest";
import { streamRegion } from "./stream-region.server";

describe("streamRegion", () => {
  it("returns without waiting for the work, and passes the value through", async () => {
    let finish: (value: number) => void = () => {};
    const pending = new Promise<number>((resolve) => {
      finish = resolve;
    });

    const region = streamRegion("route", "region", pending);
    let settled = false;
    void region.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    finish(42);
    await expect(region).resolves.toBe(42);
  });

  it("logs a structured event naming the route and region, then re-throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new TypeError("select * from shops where email = 'someone@workmanjsc.vn'");

    await expect(streamRegion("shops", "directory", Promise.reject(failure))).rejects.toBe(failure);

    const [line] = log.mock.calls.map((call) => String(call[0]));
    expect(JSON.parse(line ?? "")).toEqual({
      event: "internal.region_failed",
      route: "shops",
      region: "directory",
      errorName: "TypeError",
    });
    log.mockRestore();
  });

  it("never logs the error message, which can carry a query and its parameters", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await streamRegion("r", "g", Promise.reject(new Error("secret@workmanjsc.vn"))).catch(() => {});
    expect(log.mock.calls.map((call) => String(call[0])).join("\n")).not.toContain("secret@workmanjsc.vn");
    log.mockRestore();
  });
});
