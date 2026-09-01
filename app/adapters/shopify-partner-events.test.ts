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

  it("maps subscription history without retaining raw payloads", () => {
    expect(parsePartnerEvent({
      id: "evt-3",
      eventType: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
      occurredAt: "2026-01-02T00:00:00Z",
      shop: { id: "gid://shopify/Shop/1", myshopifyDomain: "example.myshopify.com" },
      state: "CANCELLATION_SCHEDULED",
      cancelEffectiveOn: "2026-02-01",
      plan: { handle: "pro", billingPeriod: "EVERY_30_DAYS" },
    })).toEqual({
      kind: "subscription",
      id: "evt-3",
      occurredAt: "2026-01-02T00:00:00Z",
      shop: "example.myshopify.com",
      shopId: "gid://shopify/Shop/1",
      type: "CANCELLATION_SCHEDULED",
      cancelEffectiveOn: "2026-02-01",
      planHandle: "pro",
      billingPeriod: "EVERY_30_DAYS",
    });
  });
});
