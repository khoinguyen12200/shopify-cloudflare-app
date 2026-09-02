import { describe, expect, it } from "vitest";
import { formatWebhookLog } from "./webhook-logging";

describe("webhook logs", () => {
  it("contains transport fields and never raw shop or payload data", async () => {
    const log = await formatWebhookLog({
      deliveryId: "delivery-1", topic: "app/uninstalled", shop: "secret.myshopify.com",
      handler: "app/uninstalled", outcome: "processed", attempts: 2, latencyMs: 17,
    });

    expect(log).toMatchObject({
      event: "webhook.process",
      deliveryId: "delivery-1", topic: "app/uninstalled", handler: "app/uninstalled",
      outcome: "processed", attempts: 2, latencyMs: 17,
    });
    expect(log.shopHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(log)).not.toContain("secret.myshopify.com");
    expect(JSON.stringify(log)).not.toContain("payload");
  });
});
