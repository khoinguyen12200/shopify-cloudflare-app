import { describe, it, expect } from "vitest";

/**
 * Verifies that outbound requests are blocked. If vitest.config.ts ever loses
 * `outboundService`, this test is what notices.
 */
describe("outbound network guard", () => {
  it("blocks a request to the public internet", async () => {
    const response = await fetch("https://example.com/");

    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Outbound network is blocked");
  });
});
