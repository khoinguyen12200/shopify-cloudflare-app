import { describe, expect, it } from "vitest";

describe("DOM-suite outbound network guard", () => {
  it("blocks a request to the public internet", async () => {
    const response = await fetch("https://example.com/");
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("Outbound network is blocked");
  });
});
