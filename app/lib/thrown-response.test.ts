import { describe, expect, it } from "vitest";
import { createStaticHandler } from "react-router";
import { thrownResponseHtml } from "./thrown-response";

const BOUNCE = '\n  <script data-api-key="key" src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>\n';

async function thrownBy(response: Response): Promise<unknown> {
  const handler = createStaticHandler([{ path: "/app", loader: () => { throw response; }, Component: () => null }]);
  const result = await handler.query(new Request("https://app.test/app"));
  if (result instanceof Response) throw new Error("expected a router context");
  return Object.values(result.errors ?? {})[0];
}

describe("thrownResponseHtml", () => {
  it("returns the body of a thrown success response, whatever the error class is called", () => {
    // What production sees after minification: the class is renamed, so `constructor.name` is not "ErrorResponseImpl".
    class Be { status = 200; statusText = "OK"; internal = false; data = BOUNCE; }
    const minified = new Be();
    expect(minified.constructor.name).not.toBe("ErrorResponseImpl");
    expect(thrownResponseHtml(minified)).toBe(BOUNCE);
  });

  it("returns the body of a real thrown 200 response", async () => {
    expect(thrownResponseHtml(await thrownBy(new Response(BOUNCE, { status: 200 })))).toBe(BOUNCE);
  });

  it("leaves real failures to the root boundary", async () => {
    expect(thrownResponseHtml(await thrownBy(new Response("Condition not found", { status: 404 })))).toBeNull();
    expect(thrownResponseHtml(await thrownBy(new Response("boom", { status: 500 })))).toBeNull();
    expect(thrownResponseHtml(await thrownBy(new Response(undefined, { status: 401 })))).toBeNull();
    expect(thrownResponseHtml(new Error("boom"))).toBeNull();
    expect(thrownResponseHtml(null)).toBeNull();
  });

  it("returns nothing for a success response without a text body", async () => {
    expect(thrownResponseHtml(await thrownBy(new Response(undefined, { status: 200 })))).toBeNull();
  });
});
