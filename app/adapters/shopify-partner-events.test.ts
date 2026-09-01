import { describe, expect, it } from "vitest";
import { parsePartnerEvent } from "./shopify-partner-events";

describe("parsePartnerEvent", () => {
  it("maps relationship history to typed lifecycle facts", () => {
    expect(parsePartnerEvent({
      id: "evt-1", eventType: "RELATIONSHIP_UNINSTALLED", occurredAt: "2026-01-01T00:00:00Z",
      shop: { id: "gid://shopify/Shop/1", myshopifyDomain: "example.myshopify.com" }, reason: "MERCHANT_UNINSTALL",
    })).toMatchObject({ kind: "relationship", type: "UNINSTALLED", shop: "example.myshopify.com" });
  });

  it("keeps unsupported Partner events as ignored markers", () => {
    expect(parsePartnerEvent({ id: "evt-2", eventType: "CHARGE_RECURRING" })).toEqual({ kind: "ignored", id: "evt-2" });
  });
});
