import { describe, expect, it } from "vitest";
import { createStaticHandler } from "react-router";
import { describeRequestError } from "./request-error";

const request = (url = "https://app.test/app/x?id_token=SECRET&hmac=SECRET") => new Request(url, { method: "POST" });

describe("describeRequestError", () => {
  it("ignores the 404 the router raises for an unmatched path", async () => {
    const probe = new Request("https://app.test/.git/config");
    const result = await createStaticHandler([{ path: "/app", Component: () => null }]).query(probe);
    if (result instanceof Response) throw new Error("expected a router context");
    const error = Object.values(result.errors ?? {})[0];
    expect(error).toBeDefined();
    expect(describeRequestError(error, probe)).toBeNull();
  });

  it("ignores a request the client already abandoned", () => {
    const controller = new AbortController();
    controller.abort();
    expect(describeRequestError(new Error("boom"), new Request("https://app.test/x", { signal: controller.signal }))).toBeNull();
  });

  it("describes a real failure with the path only, never the query string", () => {
    const log = describeRequestError(new TypeError("Invalid URL string."), request());
    expect(log).toMatchObject({ event: "request.error", method: "POST", path: "/app/x", errorName: "TypeError", error: "Invalid URL string." });
    expect(JSON.stringify(log)).not.toContain("SECRET");
  });

  it("describes a non-Error throw", () => {
    expect(describeRequestError("weird", request())).toMatchObject({ errorName: "string", error: "weird", stack: null });
  });
});
