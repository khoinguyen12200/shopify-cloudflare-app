import { describe, expect, it } from "vitest";
import { requireAttachmentTokenSecret } from "./wiring.server";

describe("attachment token secret", () => {
  it("uses the dedicated secret and never falls back to the Shopify API secret", () => {
    expect(requireAttachmentTokenSecret({ ATTACHMENT_TOKEN_SECRET: "attachment-secret", SHOPIFY_API_SECRET: "shopify-secret" })).toBe("attachment-secret");
  });

  it("fails loudly when the dedicated secret is absent", () => {
    expect(() => requireAttachmentTokenSecret({ SHOPIFY_API_SECRET: "shopify-secret" })).toThrow(/ATTACHMENT_TOKEN_SECRET/);
  });
});
