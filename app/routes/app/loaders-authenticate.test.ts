import { env } from "cloudflare:test";
import { RouterContextProvider, type LoaderFunctionArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { loader as home } from "./home";
import { loader as billing } from "./billing";
import { loader as supportIndex } from "./support/index";
import { loader as supportDetail } from "./support/detail";
import { loader as supportNew } from "./support/new";

/**
 * Streaming must never loosen authentication: Shopify requires a valid session
 * token on every request, so each loader still awaits `authenticateAdmin` BEFORE
 * it starts any region. A request with no token therefore gets the library's
 * own response (its session-token bounce or 401) as a rejection, never loader
 * data, and no region promise exists to leak.
 */
const loaders = { home, billing, supportIndex, supportDetail, supportNew };

const unauthenticated = new Request(
  "https://app.test/app?embedded=1&locale=en&shop=shop-one.myshopify.com&host=c2hvcDEubXlzaG9waWZ5LmNvbS9hZG1pbg&timestamp=1",
);

async function outcome(load: (args: LoaderFunctionArgs) => unknown): Promise<unknown> {
  const args: LoaderFunctionArgs = { request: unauthenticated, params: { ticketId: "t1" }, context: new RouterContextProvider(), url: new URL(unauthenticated.url), pattern: "/app" };
  return runWithRequestContext(env, async () => {
    try {
      return { resolved: await load(args) };
    } catch (error) {
      return { rejected: error };
    }
  });
}

describe("the /app loaders authenticate before streaming", () => {
  for (const [name, load] of Object.entries(loaders)) {
    it(`${name} answers an unauthenticated request with the library's response, not data`, async () => {
      const result = await outcome(load);

      expect(result).toHaveProperty("rejected");
      const { rejected } = result as { rejected: unknown };
      expect(rejected).toBeInstanceOf(Response);
      expect([302, 401]).toContain((rejected as Response).status);
    });
  }
});
