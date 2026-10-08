import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { runWithRequestContext } from "~/request-context.server";
import { authenticateAdmin } from "./require-merchant.server";

const embedded = (query: string) => new Request(`https://app.test/app?embedded=1&locale=en&${query}`);

async function failure(request: Request): Promise<unknown> {
  return runWithRequestContext(env, async () => {
    try {
      await authenticateAdmin(request);
      return null;
    } catch (error) {
      return error;
    }
  });
}

describe("authenticateAdmin", () => {
  it("answers the malformed host that used to cause a 500 with 400", async () => {
    const error = await failure(embedded("shop=shop-one.myshopify.com&host=9998966025409999999&timestamp=1"));
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(400);
  });
});
