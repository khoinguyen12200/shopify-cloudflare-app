import { describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { action, loader } from "./logout";

const args = (request: Request) => ({
  request,
  params: {},
  context: new RouterContextProvider(),
  url: new URL(request.url),
  pattern: "/internal/logout",
});

describe("internal logout", () => {
  it("rejects GET without setting a session cookie", async () => {
    const response = await loader(args(new Request("https://example.test/internal/logout")));

    expect(response.status).toBe(405);
    expect(response.headers.has("Set-Cookie")).toBe(false);
  });

  it("clears the cookie and redirects on POST", async () => {
    const response = await runWithRequestContext(env, () => action(args(new Request("https://example.test/internal/logout", { method: "POST" }))));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/internal/login");
    expect(response.headers.get("Set-Cookie")).toContain("__internal_session=");
  });
});
